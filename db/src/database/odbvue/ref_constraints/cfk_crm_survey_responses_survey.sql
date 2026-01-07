ALTER TABLE odbvue.crm_survey_responses
    ADD CONSTRAINT cfk_crm_survey_responses_survey
        FOREIGN KEY ( survey_id )
            REFERENCES odbvue.crm_surveys ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"d535717dafaa2af911c2061ffde5115ae01ea306","type":"REF_CONSTRAINT","name":"CFK_CRM_SURVEY_RESPONSES_SURVEY","schemaName":"ODBVUE","sxml":""}