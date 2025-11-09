CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_audit AS

    g_service_name    app_audit_traces.service_name%TYPE;
    g_service_version app_audit_traces.service_version%TYPE;

    FUNCTION timestamp_ns RETURN NUMBER IS
        ts TIMESTAMP WITH TIME ZONE := systimestamp;
    BEGIN
        RETURN ( extract(DAY FROM ( ts - TIMESTAMP '1970-01-01 00:00:00 UTC' )) * 86400 * 1e9 ) + ( extract(HOUR FROM ( ts - TIMESTAMP
        '1970-01-01 00:00:00 UTC' )) * 3600 * 1e9 ) + ( extract(MINUTE FROM ( ts - TIMESTAMP '1970-01-01 00:00:00 UTC' )) * 60 * 1e9 )
        + ( extract(SECOND FROM ( ts - TIMESTAMP '1970-01-01 00:00:00 UTC' )) * 1e9 );
    END timestamp_ns;

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

    PROCEDURE begin_trace (
        p_name       app_audit_spans.name%TYPE DEFAULT 'root_span',
        p_attributes IN app_audit_spans.attributes%TYPE DEFAULT NULL
    ) AS

        v_trace_id t_trace_id := lower(dbms_crypto.randombytes(16));
        v_span_id  t_span_id := lower(dbms_crypto.randombytes(8));
        PRAGMA autonomous_transaction;
    BEGIN
        INSERT INTO app_audit_traces (
            id,
            created_at,
            service_name,
            service_version
        ) VALUES ( v_trace_id,
                   systimestamp,
                   coalesce(g_service_name, 'unknown_service'),
                   coalesce(g_service_version, 'unknown_version') );

        INSERT INTO app_audit_spans (
            id,
            trace_id,
            name,
            start_time_ns,
            attributes
        ) VALUES ( v_span_id,
                   v_trace_id,
                   p_name,
                   timestamp_ns(),
                   p_attributes );

        dbms_session.set_context('OTEL_CTX', 'TRACE_ID', v_trace_id);
        dbms_session.set_context('OTEL_CTX', 'SPAN_ID', v_span_id);
        COMMIT;
    END begin_trace;

    PROCEDURE end_trace (
        p_status IN app_audit_traces.status%TYPE
    ) AS
        PRAGMA autonomous_transaction;
        v_trace_id t_trace_id := sys_context('OTEL_CTX', 'TRACE_ID');
    BEGIN
        UPDATE app_audit_traces
        SET
            status = p_status
        WHERE
            id = v_trace_id;

        UPDATE app_audit_spans
        SET
            end_time_ns = timestamp_ns(),
            status = p_status
        WHERE
                trace_id = v_trace_id
            AND end_time_ns IS NULL;

        dbms_session.clear_context('OTEL_CTX');
        COMMIT;
    END end_trace;

    PROCEDURE start_span (
        p_name       IN app_audit_spans.name%TYPE,
        p_attributes IN app_audit_spans.attributes%TYPE DEFAULT NULL
    ) AS

        v_span_id        t_span_id := lower(dbms_crypto.randombytes(8));
        v_trace_id       t_trace_id := sys_context('OTEL_CTX', 'TRACE_ID');
        v_parent_span_id t_span_id := sys_context('OTEL_CTX', 'SPAN_ID');
    BEGIN
        INSERT INTO app_audit_spans (
            id,
            trace_id,
            parent_span_id,
            name,
            attributes,
            start_time_ns
        ) VALUES ( v_span_id,
                   v_trace_id,
                   v_parent_span_id,
                   p_name,
                   p_attributes,
                   timestamp_ns() );

        dbms_session.set_context('OTEL_CTX', 'SPAN_ID', v_span_id);
        COMMIT;
    END start_span;

    PROCEDURE end_span AS
        v_span_id        t_span_id := sys_context('OTEL_CTX', 'SPAN_ID');
        PRAGMA autonomous_transaction;
        v_parent_span_id t_span_id;
    BEGIN
        UPDATE app_audit_spans
        SET
            end_time_ns = timestamp_ns()
        WHERE
            id = v_span_id
        RETURNING parent_span_id INTO v_parent_span_id;

        dbms_session.set_context('OTEL_CTX', 'SPAN_ID', v_parent_span_id);
        COMMIT;
    END end_span;

    PROCEDURE record_event (
        p_name       IN app_audit_events.name%TYPE,
        p_attributes IN app_audit_events.attributes%TYPE DEFAULT NULL
    ) AS
        v_span_id t_span_id := sys_context('OTEL_CTX', 'SPAN_ID');
        PRAGMA autonomous_transaction;
    BEGIN
        INSERT INTO app_audit_events (
            span_id,
            name,
            attributes,
            time_ns
        ) VALUES ( v_span_id,
                   p_name,
                   p_attributes,
                   timestamp_ns() );

        COMMIT;
    END record_event;

    PROCEDURE record_log (
        p_severity   IN app_audit_logs.severity_text%TYPE,
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    ) AS
        v_trace_id t_trace_id := sys_context('OTEL_CTX', 'TRACE_ID');
        PRAGMA autonomous_transaction;
    BEGIN
        INSERT INTO app_audit_logs (
            trace_id,
            span_id,
            severity_number,
            severity_text,
            message,
            attributes,
            created_at
        ) VALUES ( v_trace_id,
                   NULL,
                   CASE upper(p_severity)
                       WHEN 'TRACE' THEN
                           1
                       WHEN 'DEBUG' THEN
                           5
                       WHEN 'INFO'  THEN
                           9
                       WHEN 'WARN'  THEN
                           13
                       WHEN 'ERROR' THEN
                           17
                       WHEN 'FATAL' THEN
                           21
                       ELSE
                           9
                   END,
                   upper(p_severity),
                   p_message,
                   p_attributes,
                   systimestamp );

        COMMIT;
    END record_log;
    --
    PROCEDURE debug (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        record_log(
            p_severity => 'DEBUG',
            p_message  => p_message
        );
    END debug;

    PROCEDURE info (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        record_log(
            p_severity   => 'INFO',
            p_message    => p_message,
            p_attributes => p_attributes
        );
    END info;

    PROCEDURE warn (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        record_log(
            p_severity => 'WARN',
            p_message  => p_message
        );
    END warn;

    PROCEDURE error (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        record_log(
            p_severity => 'ERROR',
            p_message  => p_message
        );
    END error;

    PROCEDURE fatal (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    ) AS
    BEGIN
        record_log(
            p_severity => 'FATAL',
            p_message  => p_message
        );
    END fatal;

    PROCEDURE to_otel_logs (
        p_trace_id IN t_trace_id DEFAULT NULL,
        r_otel     IN OUT NOCOPY CLOB
    ) AS
        v_logs_json json_array_t;
        v_cursor    SYS_REFCURSOR;
    BEGIN

      -- Build logs array from app_audit_logs
        SELECT
            JSON_SERIALIZE(JSON_ARRAYAGG(
                JSON_OBJECT(
                    'timeUnixNano' VALUE to_char(TO_NUMBER(to_char(l.created_at, 'SSSSSSSSS')) * 1000000000),
                            'observedTimeUnixNano' VALUE to_char(TO_NUMBER(to_char(l.created_at, 'SSSSSSSSS')) * 1000000000),
                            'severityNumber' VALUE l.severity_number,
                            'severityText' VALUE l.severity_text,
                            'body' VALUE
                        JSON_OBJECT(
                            'stringValue' VALUE l.message
                        ),
                            'attributes' VALUE
                        CASE
                            WHEN l.attributes IS NOT NULL THEN
                                JSON_ARRAY()
                            ELSE
                                JSON_ARRAY()
                        END,
                            'traceId' VALUE l.trace_id,
                            'spanId' VALUE coalesce(l.span_id, ''),
                            'flags' VALUE 1
                )
            ORDER BY
                l.created_at
            )) pretty
        INTO r_otel
        FROM
                 app_audit_logs l
            JOIN app_audit_traces t ON l.trace_id = t.id
        WHERE
            ( p_trace_id IS NULL
              OR l.trace_id = p_trace_id );
      --AND ROWNUM = 1;
    END to_otel_logs;

    PROCEDURE to_otel_traces (
        p_trace_id IN t_trace_id DEFAULT NULL,
        r_otel     IN OUT NOCOPY CLOB
    ) AS
    BEGIN
        NULL; -- Implementation omitted for brevity
    END to_otel_traces;

BEGIN
    BEGIN
        WITH edition AS (
            SELECT
                sys_context('USERENV', 'CURRENT_EDITION_NAME') AS name
            FROM
                dual
        )
        SELECT
            lower(substr(name,
                         1,
                         instr(name, 'V_') - 2)),
            'v'
            || replace(
                substr(name,
                       instr(name, 'V_') + 2),
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
            g_service_version := 'unknown_version';
    END;
END pck_api_audit;
/


-- sqlcl_snapshot {"hash":"052ae53289438e574fc29ac852dd72a28f12dfe7","type":"PACKAGE_BODY","name":"PCK_API_AUDIT","schemaName":"ODBVUE","sxml":""}