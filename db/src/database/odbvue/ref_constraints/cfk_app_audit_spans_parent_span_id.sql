ALTER TABLE odbvue.app_audit_spans
    ADD CONSTRAINT cfk_app_audit_spans_parent_span_id
        FOREIGN KEY ( parent_span_id )
            REFERENCES odbvue.app_audit_spans ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"c95ac95ed0d860009ca185840f4c115fe6c59a9d","type":"REF_CONSTRAINT","name":"CFK_APP_AUDIT_SPANS_PARENT_SPAN_ID","schemaName":"ODBVUE","sxml":""}