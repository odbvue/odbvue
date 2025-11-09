ALTER TABLE odbvue.app_audit_spans
    ADD CONSTRAINT cfk_app_audit_spans_trace_id
        FOREIGN KEY ( trace_id )
            REFERENCES odbvue.app_audit_traces ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"27fb4860ee9144729144b0bf3921a18af2b8b9d8","type":"REF_CONSTRAINT","name":"CFK_APP_AUDIT_SPANS_TRACE_ID","schemaName":"ODBVUE","sxml":""}