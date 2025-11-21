ALTER TABLE odbvue.app_user_consents
    ADD CONSTRAINT cfk_app_user_consents_user
        FOREIGN KEY ( user_id )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


-- sqlcl_snapshot {"hash":"f8c880e8f1fbdbbfc42d50f93399621982a97452","type":"REF_CONSTRAINT","name":"CFK_APP_USER_CONSENTS_USER","schemaName":"ODBVUE","sxml":""}