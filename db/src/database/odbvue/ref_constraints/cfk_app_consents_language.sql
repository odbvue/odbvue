ALTER TABLE odbvue.app_consents
    ADD CONSTRAINT cfk_app_consents_language
        FOREIGN KEY ( language_id )
            REFERENCES odbvue.app_languages ( id )
        ENABLE;


-- sqlcl_snapshot {"hash":"23a5b293a135334b55b173a34799b1e5bcb0635d","type":"REF_CONSTRAINT","name":"CFK_APP_CONSENTS_LANGUAGE","schemaName":"ODBVUE","sxml":""}