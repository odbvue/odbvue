COMMENT ON TABLE odbvue.app_audit_logs IS
    'Stores audit log records associated with traces and spans.';

COMMENT ON COLUMN odbvue.app_audit_logs.attributes IS
    'A JSON object containing additional attributes for the log record.';

COMMENT ON COLUMN odbvue.app_audit_logs.created_at IS
    'The timestamp when the log record was created.';

COMMENT ON COLUMN odbvue.app_audit_logs.id IS
    'The unique identifier for the log record.';

COMMENT ON COLUMN odbvue.app_audit_logs.message IS
    'The message content of the log record.';

COMMENT ON COLUMN odbvue.app_audit_logs.severity_number IS
    'The severity number of the log record.';

COMMENT ON COLUMN odbvue.app_audit_logs.severity_text IS
    'The severity text of the log record.';

COMMENT ON COLUMN odbvue.app_audit_logs.span_id IS
    'The identifier of the span to which this log belongs, if any.';

COMMENT ON COLUMN odbvue.app_audit_logs.trace_id IS
    'The identifier of the trace to which this log belongs.';

COMMENT ON COLUMN odbvue.app_audit_logs.uuid IS
    'A virtual column extracting the uuid from the attributes JSON object.';


-- sqlcl_snapshot {"hash":"54ea399eb0cf91cc48b54fe62ed209739fd14b91","type":"COMMENT","name":"app_audit_logs","schemaName":"odbvue","sxml":""}