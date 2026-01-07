-- liquibase formatted sql
-- changeset ODBVUE:1767794233816 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_survey_questions_survey.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_survey_questions_survey.sql:null:17dd26c821e2aac7104b816bccfaaec5f31a6cf5:create

CREATE INDEX odbvue.idx_crm_survey_questions_survey ON
    odbvue.crm_survey_questions (
        survey_id
    );

