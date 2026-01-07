ALTER TABLE odbvue.crm_survey_questions
    ADD CONSTRAINT cfk_crm_survey_questions_survey
        FOREIGN KEY ( survey_id )
            REFERENCES odbvue.crm_surveys ( id )
                ON DELETE CASCADE
        ENABLE;


-- sqlcl_snapshot {"hash":"8e81740314a1bbc022cc3cfd7339474ce1c3e621","type":"REF_CONSTRAINT","name":"CFK_CRM_SURVEY_QUESTIONS_SURVEY","schemaName":"ODBVUE","sxml":""}