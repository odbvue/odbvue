CREATE OR REPLACE PACKAGE BODY odb_audit AS

  -- PRIVATE

    -- Resource attributes resolved once at package instantiation.
    g_service_name    VARCHAR2(255 CHAR);
    g_service_version VARCHAR2(255 CHAR);

  -- PUBLIC

    FUNCTION severity_number (
        p_severity_text VARCHAR2
    ) RETURN PLS_INTEGER AS
    BEGIN
        RETURN CASE upper(p_severity_text)
            WHEN 'TRACE' THEN c_severity_number_trace
            WHEN 'DEBUG' THEN c_severity_number_debug
            WHEN 'INFO'  THEN c_severity_number_info
            WHEN 'WARN'  THEN c_severity_number_warn
            WHEN 'ERROR' THEN c_severity_number_error
            WHEN 'FATAL' THEN c_severity_number_fatal
            ELSE c_severity_number_info
        END;
    END severity_number;

    FUNCTION attributes (
        key1   IN VARCHAR2,
        value1 IN VARCHAR2,
        key2   IN VARCHAR2 DEFAULT NULL,
        value2 IN VARCHAR2 DEFAULT NULL,
        key3   IN VARCHAR2 DEFAULT NULL,
        value3 IN VARCHAR2 DEFAULT NULL,
        key4   IN VARCHAR2 DEFAULT NULL,
        value4 IN VARCHAR2 DEFAULT NULL,
        key5   IN VARCHAR2 DEFAULT NULL,
        value5 IN VARCHAR2 DEFAULT NULL,
        key6   IN VARCHAR2 DEFAULT NULL,
        value6 IN VARCHAR2 DEFAULT NULL
    ) RETURN CLOB AS
        v_json json_object_t := json_object_t();
    BEGIN
        v_json.put(key1, value1);
        IF key2 IS NOT NULL THEN v_json.put(key2, value2); END IF;
        IF key3 IS NOT NULL THEN v_json.put(key3, value3); END IF;
        IF key4 IS NOT NULL THEN v_json.put(key4, value4); END IF;
        IF key5 IS NOT NULL THEN v_json.put(key5, value5); END IF;
        IF key6 IS NOT NULL THEN v_json.put(key6, value6); END IF;
        RETURN v_json.to_clob();
    END attributes;

    PROCEDURE log (
        p_severity_text   IN VARCHAR2,
        p_body            IN VARCHAR2,
        p_attributes      IN CLOB DEFAULT NULL,
        p_event_timestamp IN TIMESTAMP DEFAULT systimestamp
    ) AS
        v_attributes      json_object_t := json_object_t.parse(coalesce(p_attributes, '{}'));
        v_request_method  VARCHAR2(30 CHAR);
        v_request_uri     VARCHAR2(2000 CHAR);
        v_agent           VARCHAR2(2000 CHAR);
        v_ip              VARCHAR2(200 CHAR);
        v_error_message   VARCHAR2(2000 CHAR);
        v_error_backtrace VARCHAR2(2000 CHAR);
        v_attributes_clob CLOB;
        PRAGMA autonomous_transaction;
    BEGIN
        -- OTel Resource attributes.
        BEGIN
            IF g_service_name IS NOT NULL THEN v_attributes.put('service.name', g_service_name); END IF;
            IF g_service_version IS NOT NULL THEN v_attributes.put('service.version', g_service_version); END IF;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;

        -- HTTP request context (ORDS / mod_plsql CGI), mapped to OTel semantic conventions.
        BEGIN
            v_request_method := trim(owa_util.get_cgi_env('REQUEST_METHOD'));
            v_request_uri    := trim(owa_util.get_cgi_env('SCRIPT_NAME'));
            v_agent          := trim(owa_util.get_cgi_env('HTTP_USER_AGENT'));
            v_ip             := trim(owa_util.get_cgi_env('REMOTE_ADDR'));
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;

        IF v_request_method IS NOT NULL THEN v_attributes.put('http.request.method', v_request_method); END IF;
        IF v_request_uri IS NOT NULL THEN v_attributes.put('url.path', v_request_uri); END IF;
        IF v_agent IS NOT NULL THEN v_attributes.put('user_agent.original', v_agent); END IF;
        IF v_ip IS NOT NULL THEN v_attributes.put('client.address', v_ip); END IF;

        -- Error context (only when raised inside an exception handler), mapped to OTel exception.* attributes.
        BEGIN
            v_error_message   := substr(sqlerrm, 1, 2000);
            v_error_backtrace := substr(dbms_utility.format_error_backtrace, 1, 2000);
            IF substr(v_error_message, 1, 8) = 'ORA-0000' THEN
                v_error_message   := NULL;
                v_error_backtrace := NULL;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN NULL;
        END;

        IF v_error_message IS NOT NULL THEN v_attributes.put('exception.message', v_error_message); END IF;
        IF v_error_backtrace IS NOT NULL THEN v_attributes.put('exception.stacktrace', v_error_backtrace); END IF;

        -- Materialize to a CLOB: JSON object member functions cannot be called inside SQL (ORA-40573).
        v_attributes_clob := v_attributes.to_clob();

        INSERT INTO odb_audit_logs (
            severity_text,
            severity_number,
            body,
            attributes,
            event_timestamp
        ) VALUES (
            upper(p_severity_text),
            severity_number(p_severity_text),
            p_body,
            v_attributes_clob,
            p_event_timestamp
        );

        COMMIT;
    END log;

    PROCEDURE debug (
        p_body       IN VARCHAR2,
        p_attributes IN CLOB DEFAULT NULL
    ) AS
    BEGIN
        log('DEBUG', p_body, p_attributes);
    END debug;

    PROCEDURE info (
        p_body       IN VARCHAR2,
        p_attributes IN CLOB DEFAULT NULL
    ) AS
    BEGIN
        log('INFO', p_body, p_attributes);
    END info;

    PROCEDURE warn (
        p_body       IN VARCHAR2,
        p_attributes IN CLOB DEFAULT NULL
    ) AS
    BEGIN
        log('WARN', p_body, p_attributes);
    END warn;

    PROCEDURE error (
        p_body       IN VARCHAR2,
        p_attributes IN CLOB DEFAULT NULL
    ) AS
    BEGIN
        log('ERROR', p_body, p_attributes);
    END error;

    PROCEDURE fatal (
        p_body       IN VARCHAR2,
        p_attributes IN CLOB DEFAULT NULL
    ) AS
    BEGIN
        log('FATAL', p_body, p_attributes);
    END fatal;

    PROCEDURE bulk (
        p_data IN CLOB
    ) AS
    BEGIN
        FOR rec IN (
            SELECT
                severity_text,
                body,
                attributes,
                event_timestamp
            FROM
                JSON_TABLE ( p_data, '$[*]'
                    COLUMNS (
                        severity_text   VARCHAR2(30 CHAR) PATH '$.severity_text',
                        body            VARCHAR2(2000 CHAR) PATH '$.body',
                        attributes      CLOB FORMAT JSON PATH '$.attributes',
                        event_timestamp TIMESTAMP PATH '$.event_timestamp'
                    )
                )
        ) LOOP
            log(rec.severity_text, rec.body, rec.attributes, coalesce(rec.event_timestamp, systimestamp));
        END LOOP;
    END bulk;

    PROCEDURE purge (
        p_older_than IN TIMESTAMP
    ) AS
        PRAGMA autonomous_transaction;
    BEGIN
        DELETE FROM odb_audit_logs
        WHERE event_timestamp < p_older_than;

        COMMIT;
    END purge;

BEGIN
    -- OTel service.name defaults to the database name; callers may override via attributes.
    BEGIN
        g_service_name := lower(sys_context('USERENV', 'DB_NAME'));
    EXCEPTION
        WHEN OTHERS THEN
            g_service_name := NULL;
    END;
END odb_audit;
/
