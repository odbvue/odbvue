ALTER TABLE odbvue.app_audit_events
    ADD CONSTRAINT cfk_app_audit_events_span
        FOREIGN KEY ( span_id )
            REFERENCES odbvue.app_audit_spans ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"6a559f99007b778eb41a9a3cb47c1f58908081a0","type":"REF_CONSTRAINT","name":"CFK_APP_AUDIT_EVENTS_SPAN","schemaName":"ODBVUE","sxml":""}