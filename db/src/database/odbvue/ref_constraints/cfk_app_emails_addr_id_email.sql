ALTER TABLE odbvue.app_emails_addr
    ADD CONSTRAINT cfk_app_emails_addr_id_email
        FOREIGN KEY ( id_email )
            REFERENCES odbvue.app_emails ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"f09d2592a83ea8cf7bef7bfe1ad3c3c69812531b","type":"REF_CONSTRAINT","name":"CFK_APP_EMAILS_ADDR_ID_EMAIL","schemaName":"ODBVUE","sxml":""}