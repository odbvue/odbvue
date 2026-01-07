-- liquibase formatted sql
-- changeset ODBVUE:1767794234482 stripComments:false  logicalFilePath:featcrm\odbvue\ref_constraints\cfk_crm_survey_responses_survey.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_crm_survey_responses_survey.sql:null:d535717dafaa2af911c2061ffde5115ae01ea306:create

ALTER TABLE odbvue.crm_survey_responses
    ADD CONSTRAINT cfk_crm_survey_responses_survey
        FOREIGN KEY ( survey_id )
            REFERENCES odbvue.crm_surveys ( id )
                ON DELETE CASCADE
        ENABLE;

