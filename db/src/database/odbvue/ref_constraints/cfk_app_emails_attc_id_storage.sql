ALTER TABLE odbvue.app_emails_attc
    ADD CONSTRAINT cfk_app_emails_attc_id_storage
        FOREIGN KEY ( id_storage )
            REFERENCES odbvue.app_storage ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"e22d44b3aec78bb67fb661cb58045d00fcf1ec7d","type":"REF_CONSTRAINT","name":"CFK_APP_EMAILS_ATTC_ID_STORAGE","schemaName":"ODBVUE","sxml":""}