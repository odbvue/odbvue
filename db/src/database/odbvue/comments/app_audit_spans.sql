COMMENT ON TABLE odbvue.app_audit_spans IS
    'Stores audit span records representing individual spans within a trace.';

COMMENT ON COLUMN odbvue.app_audit_spans.attributes IS
    'A JSON object containing additional attributes for the span.';

COMMENT ON COLUMN odbvue.app_audit_spans.end_time_ns IS
    'The end time of the span in nanoseconds.';

COMMENT ON COLUMN odbvue.app_audit_spans.id IS
    'The unique identifier for the span.';

COMMENT ON COLUMN odbvue.app_audit_spans.kind IS
    'The kind of span (e.g., INTERNAL, SERVER, CLIENT).';

COMMENT ON COLUMN odbvue.app_audit_spans.name IS
    'The name of the span.';

COMMENT ON COLUMN odbvue.app_audit_spans.parent_span_id IS
    'The identifier of the parent span, if any.';

COMMENT ON COLUMN odbvue.app_audit_spans.start_time_ns IS
    'The start time of the span in nanoseconds.';

COMMENT ON COLUMN odbvue.app_audit_spans.status IS
    'The status of the span, indicating whether it is OK, ERROR, or UNSET.';

COMMENT ON COLUMN odbvue.app_audit_spans.trace_id IS
    'The identifier of the trace to which this span belongs.';


-- sqlcl_snapshot {"hash":"499ae169e58ab2cb1602e25dea2d9b47f48c41c4","type":"COMMENT","name":"app_audit_spans","schemaName":"odbvue","sxml":""}