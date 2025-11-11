ALTER TABLE odbvue.app_label_links
    ADD CONSTRAINT cfk_app_label_links_label_id
        FOREIGN KEY ( label_id )
            REFERENCES odbvue.app_labels ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"5d698e7231cafb9613c710296ad99ed2a27f313a","type":"REF_CONSTRAINT","name":"CFK_APP_LABEL_LINKS_LABEL_ID","schemaName":"ODBVUE","sxml":""}