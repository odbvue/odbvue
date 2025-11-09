ALTER TABLE odbvue.app_audit_logs
    ADD CONSTRAINT cfk_app_audit_logs_span
        FOREIGN KEY ( span_id )
            REFERENCES odbvue.app_audit_spans ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"77bcb92c1f4f7e3aed547a4a2e41d6f955c2064c","type":"REF_CONSTRAINT","name":"CFK_APP_AUDIT_LOGS_SPAN","schemaName":"ODBVUE","sxml":""}