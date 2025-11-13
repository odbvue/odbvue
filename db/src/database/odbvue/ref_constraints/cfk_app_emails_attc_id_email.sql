ALTER TABLE odbvue.app_emails_attc
    ADD CONSTRAINT cfk_app_emails_attc_id_email
        FOREIGN KEY ( id_email )
            REFERENCES odbvue.app_emails ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"5e57bbdf3f6f816305caaa316c7a3c29c748c087","type":"REF_CONSTRAINT","name":"CFK_APP_EMAILS_ATTC_ID_EMAIL","schemaName":"ODBVUE","sxml":""}