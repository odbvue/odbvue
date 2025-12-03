-- liquibase formatted sql
-- changeset ODBVUE:1764755057889 stripComments:false  logicalFilePath:featadmin\odbvue\package_bodies\pck_api_audit.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_audit.sql:c87a204de7b1e8a6d40f64c4673df4069da225d3:e197f5b24648e27657cc4b0dbb559f4f4aa0f437:alter

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_audit AS

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
        IF key2 IS NOT NULL THEN
            v_json.put(key2, value2);
        END IF;
        IF key3 IS NOT NULL THEN
            v_json.put(key3, value3);
        END IF;
        IF key4 IS NOT NULL THEN
            v_json.put(key4, value4);
        END IF;
        IF key5 IS NOT NULL THEN
            v_json.put(key5, value5);
        END IF;
        IF key6 IS NOT NULL THEN
            v_json.put(key6, value6);
        END IF;
        RETURN v_json.to_clob();
    END attributes;

    PROCEDURE errors ( -- Helper to populate error messages
        r_errors IN OUT SYS_REFCURSOR, -- Ref Cursor
        key1     IN VARCHAR2, -- Key 1
        value1   IN VARCHAR2, -- Value 1
        key2     IN VARCHAR2 DEFAULT NULL, -- Key 2
        value2   IN VARCHAR2 DEFAULT NULL, -- Value 2
        key3     IN VARCHAR2 DEFAULT NULL, -- Key 3
        value3   IN VARCHAR2 DEFAULT NULL, -- Value 3
        key4     IN VARCHAR2 DEFAULT NULL, -- Key 4
        value4   IN VARCHAR2 DEFAULT NULL, -- Value 4
        key5     IN VARCHAR2 DEFAULT NULL, -- Key 5
        value5   IN VARCHAR2 DEFAULT NULL, -- Value 5
        key6     IN VARCHAR2 DEFAULT NULL, -- Key 6
        value6   IN VARCHAR2 DEFAULT NULL -- Value 6
    ) AS
    BEGIN
        OPEN r_errors FOR SELECT
                                                                                                                                          key1   AS
                                                                                                                                          "name"
                                                                                                                                          ,
                                                                                                                                          value1 AS
                                                                                                                                          "message"
                                                                                                                                      FROM
                                                                                                                                          dual
                                                                                                                    WHERE
                                                                                                                        key1 IS NOT NULL
                                                                                                  UNION ALL
                                                                                                  SELECT
                                                                                                      key2   AS "name",
                                                                                                      value2 AS "message"
                                                                                                  FROM
                                                                                                      dual
                                                                                                  WHERE
                                                                                                      key2 IS NOT NULL
                                                                                UNION ALL
                                                                                SELECT
                                                                                    key3   AS "name",
                                                                                    value3 AS "message"
                                                                                FROM
                                                                                    dual
                                                                                WHERE
                                                                                    key3 IS NOT NULL
                                                              UNION ALL
                                                              SELECT
                                                                  key4   AS "name",
                                                                  value4 AS "message"
                                                              FROM
                                                                  dual
                                                              WHERE
                                                                  key4 IS NOT NULL
                                            UNION ALL
                                            SELECT
                                                key5   AS "name",
                                                value5 AS "message"
                                            FROM
                                                dual
                                            WHERE
                                                key5 IS NOT NULL
                          UNION ALL
                          SELECT
                              key6   AS "name",
                              value6 AS "message"
                          FROM
                              dual
                          WHERE
                              key6 IS NOT NULL;

    END errors;

    PROCEDURE log (
        p_severity   IN VARCHAR2,
        p_message    IN app_audit.message%TYPE,
        p_attributes IN app_audit.attributes%TYPE DEFAULT NULL,
        p_created    IN TIMESTAMP DEFAULT systimestamp
    ) AS

        v_request_method  VARCHAR2(30 CHAR);
        v_request_uri     VARCHAR2(2000 CHAR);
        v_agent           VARCHAR2(2000 CHAR);
        v_ip              VARCHAR2(200 CHAR);
        v_error_message   VARCHAR2(2000 CHAR);
        v_error_backtrace VARCHAR2(2000 CHAR);
        v_attributes      json_object_t := json_object_t.parse(coalesce(p_attributes, '{}'));
        v_attributes_clob CLOB;
        PRAGMA autonomous_transaction;
    BEGIN
        BEGIN
            v_attributes.put('service_name', g_service_name);
            v_attributes.put('service_version', g_service_version);
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        BEGIN
            v_request_method := trim(owa_util.get_cgi_env('REQUEST_METHOD'));
            v_request_uri := trim(owa_util.get_cgi_env('SCRIPT_NAME'));
            v_agent := trim(owa_util.get_cgi_env('HTTP_USER_AGENT'));
            v_ip := trim(owa_util.get_cgi_env('REMOTE_ADDR'));
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        IF v_request_method IS NOT NULL THEN
            v_attributes.put('request_method', v_request_method);
        END IF;
        IF v_request_uri IS NOT NULL THEN
            DECLARE
                v_module VARCHAR2(200 CHAR) := regexp_substr(v_request_uri, '[^/]+', 1, 3);
                v_method VARCHAR2(200 CHAR) := regexp_substr(v_request_uri, '[^/]+', 1, 4);
            BEGIN
                IF v_module IS NOT NULL THEN
                    v_attributes.put('module_name', v_module);
                END IF;
                IF v_method IS NOT NULL THEN
                    v_attributes.put('method_name', v_method);
                END IF;
            EXCEPTION
                WHEN OTHERS THEN
                    NULL;
            END;
        END IF;

        IF v_agent IS NOT NULL THEN
            v_attributes.put('request_user_agent', v_agent);
        END IF;
        IF v_ip IS NOT NULL THEN
            v_attributes.put('request_client_ip', v_ip);
        END IF;
        BEGIN
            v_error_message := substr(sqlerrm, 1, 2000);
            v_error_backtrace := substr(dbms_utility.format_error_backtrace, 1, 2000);
            CASE
                WHEN substr(v_error_message, 1, 8) = 'ORA-0000' THEN
                    v_error_message := NULL;
                    v_error_backtrace := NULL;
            END CASE;

        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        IF v_error_message IS NOT NULL THEN
            v_attributes.put('error_message', v_error_message);
        END IF;
        IF v_error_backtrace IS NOT NULL THEN
            v_attributes.put('error_stack', v_error_backtrace);
        END IF;
        v_attributes_clob := v_attributes.to_clob();
        INSERT INTO app_audit (
            severity,
            message,
            attributes,
            created
        ) VALUES ( p_severity,
                   p_message,
                   v_attributes_clob,
                   p_created );

        COMMIT;
    END log;

    PROCEDURE debug (
        p_message    app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('DEBUG', p_message, p_attributes);
    END debug;

    PROCEDURE info (
        p_message    app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('INFO', p_message, p_attributes);
    END info;

    PROCEDURE warn (
        p_message    app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('WARN', p_message, p_attributes);
    END warn;

    PROCEDURE error (
        p_message    app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('ERROR', p_message, p_attributes);
    END error;

    PROCEDURE fatal (
        p_message    app_audit.message%TYPE,
        p_attributes app_audit.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        log('FATAL', p_message, p_attributes);
    END fatal;

    PROCEDURE bulk (
        p_data CLOB
    ) AS
    BEGIN
        FOR rec IN (
            SELECT
                severity,
                message,
                attributes,
                created
            FROM
                JSON_TABLE ( p_data, '$[*]'
                    COLUMNS (
                        severity VARCHAR2 ( 30 CHAR ) PATH '$.severity',
                        message VARCHAR2 ( 2000 CHAR ) PATH '$.message',
                        attributes CLOB FORMAT JSON PATH '$.attributes',
                        created TIMESTAMP PATH '$.created'
                    )
                )
        ) LOOP
            log(rec.severity, rec.message, rec.attributes, rec.created);
        END LOOP;
    END;

    PROCEDURE archive (
        p_older_than IN TIMESTAMP
    ) AS
        PRAGMA autonomous_transaction;
    BEGIN
        INSERT INTO app_audit_archive (
            id,
            severity,
            message,
            attributes,
            created
        )
            SELECT
                id,
                severity,
                message,
                attributes,
                created
            FROM
                app_audit
            WHERE
                created < p_older_than;

        DELETE FROM app_audit
        WHERE
            created < p_older_than;

        COMMIT;
        dbms_output.put_line('Archived '
                             || SQL%rowcount
                             || ' audit records older than '
                             || p_older_than || '.');

    END archive;

BEGIN
    BEGIN
        WITH edition AS (
            SELECT
                upper(sys_context('USERENV', 'CURRENT_EDITION_NAME')) AS name
            FROM
                dual
        )
        SELECT
            lower(substr(name,
                         1,
                         instr(name, '_V') - 1)),
            'v'
            || replace(
                substr(name,
                       instr(name, '_V') + 2),
                '_',
                '.'
            )
        INTO
            g_service_name,
            g_service_version
        FROM
            edition;

    EXCEPTION
        WHEN OTHERS THEN
            g_service_name := 'unknown_service';
            g_service_version := 'unknown_version';
    END;
END pck_api_audit;
/

