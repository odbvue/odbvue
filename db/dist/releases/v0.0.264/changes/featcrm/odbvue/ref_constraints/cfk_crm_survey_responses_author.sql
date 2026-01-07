-- liquibase formatted sql
-- changeset ODBVUE:1767794234385 stripComments:false  logicalFilePath:featcrm\odbvue\ref_constraints\cfk_crm_survey_responses_author.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_crm_survey_responses_author.sql:null:3c956b017d65cd7a830cc98d831b0c7f58fbf6e3:create

ALTER TABLE odbvue.crm_survey_responses
    ADD CONSTRAINT cfk_crm_survey_responses_author
        FOREIGN KEY ( author )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;

