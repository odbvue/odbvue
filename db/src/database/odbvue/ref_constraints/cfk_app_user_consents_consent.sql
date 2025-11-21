ALTER TABLE odbvue.app_user_consents
    ADD CONSTRAINT cfk_app_user_consents_consent
        FOREIGN KEY ( consent_id )
            REFERENCES odbvue.app_consents ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"02b5a5ea77c8d4691492cdda706f12022f6249c5","type":"REF_CONSTRAINT","name":"CFK_APP_USER_CONSENTS_CONSENT","schemaName":"ODBVUE","sxml":""}