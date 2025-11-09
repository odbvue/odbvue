COMMENT ON TABLE odbvue.app_audit_events IS
    'Stores audit event records associated with spans.';

COMMENT ON COLUMN odbvue.app_audit_events.attributes IS
    'A JSON object containing additional attributes for the event.';

COMMENT ON COLUMN odbvue.app_audit_events.event_id IS
    'The unique identifier for the event.';

COMMENT ON COLUMN odbvue.app_audit_events.name IS
    'The name of the event.';

COMMENT ON COLUMN odbvue.app_audit_events.span_id IS
    'The identifier of the span to which this event belongs.';

COMMENT ON COLUMN odbvue.app_audit_events.time_ns IS
    'The time of the event in nanoseconds.';


-- sqlcl_snapshot {"hash":"b547dd5eda8a572a3147b170479dfcd57794cc63","type":"COMMENT","name":"app_audit_events","schemaName":"odbvue","sxml":""}