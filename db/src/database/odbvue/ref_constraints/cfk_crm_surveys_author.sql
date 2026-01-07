ALTER TABLE odbvue.crm_surveys
    ADD CONSTRAINT cfk_crm_surveys_author
        FOREIGN KEY ( author )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


-- sqlcl_snapshot {"hash":"2592c0c28e7cb94a1169cd3774ae7bfb0c02f1f5","type":"REF_CONSTRAINT","name":"CFK_CRM_SURVEYS_AUTHOR","schemaName":"ODBVUE","sxml":""}