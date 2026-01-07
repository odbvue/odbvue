-- liquibase formatted sql
-- changeset ODBVUE:1767794234300 stripComments:false  logicalFilePath:featcrm\odbvue\ref_constraints\cfk_crm_survey_questions_survey.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_crm_survey_questions_survey.sql:null:8e81740314a1bbc022cc3cfd7339474ce1c3e621:create

ALTER TABLE odbvue.crm_survey_questions
    ADD CONSTRAINT cfk_crm_survey_questions_survey
        FOREIGN KEY ( survey_id )
            REFERENCES odbvue.crm_surveys ( id )
                ON DELETE CASCADE
        ENABLE;

