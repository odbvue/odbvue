ALTER TABLE odbvue.crm_survey_responses
    ADD CONSTRAINT cfk_crm_survey_responses_author
        FOREIGN KEY ( author )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;


-- sqlcl_snapshot {"hash":"3c956b017d65cd7a830cc98d831b0c7f58fbf6e3","type":"REF_CONSTRAINT","name":"CFK_CRM_SURVEY_RESPONSES_AUTHOR","schemaName":"ODBVUE","sxml":""}