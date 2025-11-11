ALTER TABLE odbvue.label_links
    ADD CONSTRAINT cfk_label_links_label_id
        FOREIGN KEY ( label_id )
            REFERENCES odbvue.labels ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"2c5f1a378483d9933a4f7aba12b7f5f34e0646c9","type":"REF_CONSTRAINT","name":"CFK_LABEL_LINKS_LABEL_ID","schemaName":"ODBVUE","sxml":""}