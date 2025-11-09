COMMENT ON TABLE odbvue.app_audit_traces IS
    'Stores audit trace records representing a single trace in the system.';

COMMENT ON COLUMN odbvue.app_audit_traces.created_at IS
    'The timestamp when the trace was created.';

COMMENT ON COLUMN odbvue.app_audit_traces.id IS
    'The unique identifier for the trace.';

COMMENT ON COLUMN odbvue.app_audit_traces.service_name IS
    'The name of the service associated with the trace.';

COMMENT ON COLUMN odbvue.app_audit_traces.service_version IS
    'The version of the service associated with the trace.';

COMMENT ON COLUMN odbvue.app_audit_traces.status IS
    'The status of the trace, indicating whether it is OK, ERROR, or UNSET.';


-- sqlcl_snapshot {"hash":"17c3e30032fb9704a545cf5ad84cd044c4dd5573","type":"COMMENT","name":"app_audit_traces","schemaName":"odbvue","sxml":""}