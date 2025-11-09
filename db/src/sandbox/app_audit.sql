DROP TABLE app_audit_logs PURGE;
DROP TABLE app_audit_events PURGE;
DROP TABLE app_audit_spans PURGE;
DROP TABLE app_audit_traces PURGE;
/

GRANT CREATE ANY CONTEXT TO ODBVUE;
GRANT EXECUTE ON DBMS_SESSION TO ODBVUE;
CREATE CONTEXT otel_ctx USING pck_api_audit;
/

CREATE TABLE app_audit_traces (
    id        CHAR(32 CHAR) NOT NULL,
    service_name    VARCHAR2(200 CHAR),
    service_version VARCHAR2(30 CHAR),
    created_at      TIMESTAMP(6) DEFAULT SYSTIMESTAMP NOT NULL,
    status          VARCHAR2(30 CHAR)    DEFAULT 'UNSET', 
    CONSTRAINT cpk_app_audit_traces PRIMARY KEY (id),
    CONSTRAINT chk_app_audit_traces_status CHECK (status IN ('OK', 'ERROR', 'UNSET'))
);

COMMENT ON TABLE app_audit_traces IS 'Stores audit trace records representing a single trace in the system.';
COMMENT ON COLUMN app_audit_traces.id IS 'The unique identifier for the trace.';
COMMENT ON COLUMN app_audit_traces.service_name IS 'The name of the service associated with the trace.';
COMMENT ON COLUMN app_audit_traces.service_version IS 'The version of the service associated with the trace.';
COMMENT ON COLUMN app_audit_traces.created_at IS 'The timestamp when the trace was created.';
COMMENT ON COLUMN app_audit_traces.status IS 'The status of the trace, indicating whether it is OK, ERROR, or UNSET.';


CREATE INDEX idx_app_audit_traces_created_at ON app_audit_traces(created_at);
/

CREATE TABLE app_audit_spans (
    id         CHAR(16 CHAR) NOT NULL,  
    trace_id        CHAR(32 CHAR)    NOT NULL,
    parent_span_id  CHAR(16 CHAR),
    name            VARCHAR2(200 CHAR)   NOT NULL,
    kind            VARCHAR2(30 CHAR)  DEFAULT 'INTERNAL' NOT NULL,
    start_time_ns   NUMBER(19)      NOT NULL,    
    end_time_ns     NUMBER(19),
    status          VARCHAR2(30 CHAR)    DEFAULT 'UNSET', 
    attributes     CLOB,  
    CONSTRAINT cpk_app_audit_spans PRIMARY KEY (id),
    CONSTRAINT cfk_app_audit_spans_trace_id FOREIGN KEY (trace_id) REFERENCES app_audit_traces(id) ON DELETE CASCADE,
    CONSTRAINT cfk_app_audit_spans_parent_span_id FOREIGN KEY (parent_span_id) REFERENCES app_audit_spans(id) ON DELETE CASCADE,
    CONSTRAINT chk_app_audit_spans_status CHECK (status IN ('OK', 'ERROR', 'UNSET')),
    CONSTRAINT chk_app_audit_spans_attributes CHECK (attributes IS JSON),
    CONSTRAINT cuq_app_audit_spans UNIQUE (trace_id, id)
);

COMMENT ON TABLE app_audit_spans IS 'Stores audit span records representing individual spans within a trace.';
COMMENT ON COLUMN app_audit_spans.id IS 'The unique identifier for the span.';
COMMENT ON COLUMN app_audit_spans.trace_id IS 'The identifier of the trace to which this span belongs.';
COMMENT ON COLUMN app_audit_spans.parent_span_id IS 'The identifier of the parent span, if any.';
COMMENT ON COLUMN app_audit_spans.name IS 'The name of the span.';
COMMENT ON COLUMN app_audit_spans.kind IS 'The kind of span (e.g., INTERNAL, SERVER, CLIENT).';
COMMENT ON COLUMN app_audit_spans.start_time_ns IS 'The start time of the span in nanoseconds.';
COMMENT ON COLUMN app_audit_spans.end_time_ns IS 'The end time of the span in nanoseconds.';
COMMENT ON COLUMN app_audit_spans.status IS 'The status of the span, indicating whether it is OK, ERROR, or UNSET.';
COMMENT ON COLUMN app_audit_spans.attributes IS 'A JSON object containing additional attributes for the span.';

CREATE INDEX idx_app_audit_spans_trace_id ON app_audit_spans(trace_id);
CREATE INDEX idx_app_audit_spans_parent_span_id ON app_audit_spans(parent_span_id);
/

CREATE TABLE app_audit_events (
    event_id        NUMBER(19)      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    span_id         CHAR(16 CHAR)    NOT NULL ,
    name            VARCHAR2(200 CHAR)   NOT NULL,
    time_ns         NUMBER(19)      NOT NULL,
    attributes      CLOB,
    CONSTRAINT chk_app_audit_events_attributes CHECK (attributes IS JSON),
    CONSTRAINT cfk_app_audit_events_span FOREIGN KEY (span_id) REFERENCES app_audit_spans(id) ON DELETE CASCADE
);

COMMENT ON TABLE app_audit_events IS 'Stores audit event records associated with spans.';
COMMENT ON COLUMN app_audit_events.event_id IS 'The unique identifier for the event.';
COMMENT ON COLUMN app_audit_events.span_id IS 'The identifier of the span to which this event belongs.';
COMMENT ON COLUMN app_audit_events.name IS 'The name of the event.';
COMMENT ON COLUMN app_audit_events.time_ns IS 'The time of the event in nanoseconds.';
COMMENT ON COLUMN app_audit_events.attributes IS 'A JSON object containing additional attributes for the event.';


CREATE INDEX idx_app_audit_events_span_id ON app_audit_events(span_id);
/

CREATE TABLE app_audit_logs (
    id          CHAR(32 CHAR)  DEFAULT LOWER(SYS_GUID()) NOT NULL,
    trace_id        CHAR(32 CHAR)    NOT NULL,
    span_id         CHAR(16 CHAR),
    severity_number NUMBER(2)          DEFAULT 9 NOT NULL,
    severity_text   VARCHAR2(30 CHAR) NOT NULL,
    message         VARCHAR2(2000 CHAR)  NOT NULL,
    created_at      TIMESTAMP       DEFAULT SYSTIMESTAMP NOT NULL,
    attributes      CLOB,


    uuid          VARCHAR2(32 CHAR)
    GENERATED ALWAYS AS (
      json_value(attributes, '$.uuid' RETURNING VARCHAR2(32 CHAR) NULL ON ERROR NULL ON EMPTY)
    ) VIRTUAL,

    CONSTRAINT cpk_app_audit_logs PRIMARY KEY (id),
    CONSTRAINT cfk_app_audit_logs_trace FOREIGN KEY (trace_id) REFERENCES app_audit_traces(id) ON DELETE CASCADE,
    CONSTRAINT cfk_app_audit_logs_span FOREIGN KEY (span_id) REFERENCES app_audit_spans(id) ON DELETE CASCADE,
    CONSTRAINT chk_app_audit_logs_attributes CHECK (attributes IS JSON),
    CONSTRAINT chk_app_audit_logs_severity_number CHECK (severity_number BETWEEN 1 AND 24),
    CONSTRAINT chk_app_audit_logs_severity_text CHECK (severity_text IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'))
);


COMMENT ON TABLE app_audit_logs IS 'Stores audit log records associated with traces and spans.';
COMMENT ON COLUMN app_audit_logs.id IS 'The unique identifier for the log record.';
COMMENT ON COLUMN app_audit_logs.trace_id IS 'The identifier of the trace to which this log belongs.';
COMMENT ON COLUMN app_audit_logs.span_id IS 'The identifier of the span to which this log belongs, if any.';
COMMENT ON COLUMN app_audit_logs.severity_number IS 'The severity number of the log record.';
COMMENT ON COLUMN app_audit_logs.severity_text IS 'The severity text of the log record.';
COMMENT ON COLUMN app_audit_logs.message IS 'The message content of the log record.';
COMMENT ON COLUMN app_audit_logs.created_at IS 'The timestamp when the log record was created.';
COMMENT ON COLUMN app_audit_logs.attributes IS 'A JSON object containing additional attributes for the log record.';
COMMENT ON COLUMN app_audit_logs.uuid IS 'A virtual column extracting the uuid from the attributes JSON object.';

CREATE INDEX idx_app_audit_logs_trace_id ON app_audit_logs(trace_id);
CREATE INDEX idx_app_audit_logs_span_id ON app_audit_logs(span_id);
CREATE INDEX idx_app_audit_logs_created_at ON app_audit_logs(created_at);

CREATE INDEX idx_app_audit_logs_uuid ON app_audit_logs(uuid);
/
