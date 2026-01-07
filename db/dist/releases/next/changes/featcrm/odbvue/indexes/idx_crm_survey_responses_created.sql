-- liquibase formatted sql
-- changeset ODBVUE:1767794234006 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_survey_responses_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_survey_responses_created.sql:null:64498aa1066456b12ab639eb1d6c3991e98f04f2:create

CREATE INDEX odbvue.idx_crm_survey_responses_created ON
    odbvue.crm_survey_responses (
        created
    );

