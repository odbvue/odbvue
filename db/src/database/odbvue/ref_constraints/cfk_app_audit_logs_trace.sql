ALTER TABLE odbvue.app_audit_logs
    ADD CONSTRAINT cfk_app_audit_logs_trace
        FOREIGN KEY ( trace_id )
            REFERENCES odbvue.app_audit_traces ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"95ee3d48bdd5a08d4eff11037b6092db41311699","type":"REF_CONSTRAINT","name":"CFK_APP_AUDIT_LOGS_TRACE","schemaName":"ODBVUE","sxml":""}