CREATE OR REPLACE PACKAGE odb_audit AS -- OpenTelemetry-aligned audit log API (logs only; no spans/traces yet).

    -- OTel SeverityNumber values (https://opentelemetry.io/docs/specs/otel/logs/data-model/#field-severitynumber).
    -- Only the lowest number of each range is used; SeverityText carries the short name.
    c_severity_number_trace CONSTANT PLS_INTEGER := 1;
    c_severity_number_debug CONSTANT PLS_INTEGER := 5;
    c_severity_number_info  CONSTANT PLS_INTEGER := 9;
    c_severity_number_warn  CONSTANT PLS_INTEGER := 13;
    c_severity_number_error CONSTANT PLS_INTEGER := 17;
    c_severity_number_fatal CONSTANT PLS_INTEGER := 21;

    FUNCTION severity_number ( -- Maps a SeverityText to its OTel SeverityNumber
        p_severity_text VARCHAR2 -- TRACE / DEBUG / INFO / WARN / ERROR / FATAL
    ) RETURN PLS_INTEGER; -- OTel SeverityNumber (defaults to INFO for unknown text)

    FUNCTION attributes ( -- Helper to build a JSON attributes object from up to 6 key/value pairs
        key1   IN VARCHAR2, -- Key 1
        value1 IN VARCHAR2, -- Value 1
        key2   IN VARCHAR2 DEFAULT NULL, -- Key 2
        value2 IN VARCHAR2 DEFAULT NULL, -- Value 2
        key3   IN VARCHAR2 DEFAULT NULL, -- Key 3
        value3 IN VARCHAR2 DEFAULT NULL, -- Value 3
        key4   IN VARCHAR2 DEFAULT NULL, -- Key 4
        value4 IN VARCHAR2 DEFAULT NULL, -- Value 4
        key5   IN VARCHAR2 DEFAULT NULL, -- Key 5
        value5 IN VARCHAR2 DEFAULT NULL, -- Value 5
        key6   IN VARCHAR2 DEFAULT NULL, -- Key 6
        value6 IN VARCHAR2 DEFAULT NULL  -- Value 6
    ) RETURN CLOB; -- JSON object as CLOB

    PROCEDURE log ( -- Writes a single audit log record (OTel LogRecord) in an autonomous transaction
        p_severity_text   IN VARCHAR2, -- OTel SeverityText (TRACE / DEBUG / INFO / WARN / ERROR / FATAL)
        p_body            IN VARCHAR2, -- OTel Body (human-readable message)
        p_attributes      IN CLOB DEFAULT NULL, -- OTel Attributes (JSON object)
        p_event_timestamp IN TIMESTAMP DEFAULT systimestamp -- OTel Timestamp (event time)
    );

    PROCEDURE debug ( -- Logs at DEBUG severity
        p_body       IN VARCHAR2, -- Message
        p_attributes IN CLOB DEFAULT NULL -- JSON attributes
    );

    PROCEDURE info ( -- Logs at INFO severity
        p_body       IN VARCHAR2, -- Message
        p_attributes IN CLOB DEFAULT NULL -- JSON attributes
    );

    PROCEDURE warn ( -- Logs at WARN severity
        p_body       IN VARCHAR2, -- Message
        p_attributes IN CLOB DEFAULT NULL -- JSON attributes
    );

    PROCEDURE error ( -- Logs at ERROR severity
        p_body       IN VARCHAR2, -- Message
        p_attributes IN CLOB DEFAULT NULL -- JSON attributes
    );

    PROCEDURE fatal ( -- Logs at FATAL severity
        p_body       IN VARCHAR2, -- Message
        p_attributes IN CLOB DEFAULT NULL -- JSON attributes
    );

    PROCEDURE bulk ( -- Writes many records from a JSON array of log records
        p_data IN CLOB -- JSON array: [{ "severity_text", "body", "attributes", "event_timestamp" }, ...]
    );

    PROCEDURE purge ( -- Deletes records older than a cut-off in an autonomous transaction
        p_older_than IN TIMESTAMP -- Delete records whose event_timestamp is before this value
    );

END odb_audit;
/
