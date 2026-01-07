-- liquibase formatted sql
-- changeset ODBVUE:1767794234079 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_survey_responses_survey.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_survey_responses_survey.sql:null:b6206a6e84cc19c9c8163a1611a0fddcf5f04bf4:create

CREATE INDEX odbvue.idx_crm_survey_responses_survey ON
    odbvue.crm_survey_responses (
        survey_id
    );

