CREATE OR REPLACE PACKAGE odbvue.pck_api_audit AS
    FUNCTION timestamp_ns RETURN NUMBER;

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
    ) RETURN CLOB;

    PROCEDURE begin_trace (
        p_name       app_audit_spans.name%TYPE DEFAULT 'root_span',
        p_attributes IN app_audit_spans.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE end_trace (
        p_status IN app_audit_traces.status%TYPE
    );

    PROCEDURE start_span (
        p_name       IN app_audit_spans.name%TYPE,
        p_attributes IN app_audit_spans.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE end_span;

    PROCEDURE record_event (
        p_name       IN app_audit_events.name%TYPE,
        p_attributes IN app_audit_events.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE record_log (
        p_severity   IN app_audit_logs.severity_text%TYPE,
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE debug (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE info (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE warn (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE error (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE fatal (
        p_message    IN app_audit_logs.message%TYPE,
        p_attributes IN app_audit_logs.attributes%TYPE DEFAULT NULL
    );

    PROCEDURE otel_logs (
        p_trace_id    IN app_audit_traces.id%TYPE,
        p_period_from IN TIMESTAMP,
        p_period_to   IN TIMESTAMP,
        p_limit       PLS_INTEGER DEFAULT 1000,
        p_offset      PLS_INTEGER DEFAULT 0,
        r_otel        OUT SYS_REFCURSOR
    );

    PROCEDURE otel_spans (
        p_trace_id    IN app_audit_traces.id%TYPE,
        p_period_from IN TIMESTAMP,
        p_period_to   IN TIMESTAMP,
        p_limit       PLS_INTEGER DEFAULT 1000,
        p_offset      PLS_INTEGER DEFAULT 0,
        r_otel        OUT SYS_REFCURSOR
    );

END pck_api_audit;
/


-- sqlcl_snapshot {"hash":"c5c18afd23ab3fe865c12f5790f0d8221e36e3c8","type":"PACKAGE_SPEC","name":"PCK_API_AUDIT","schemaName":"ODBVUE","sxml":""}