-- liquibase formatted sql
-- changeset ODBVUE:1767794233906 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_survey_responses_author.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_survey_responses_author.sql:null:b87882f5f3dbf5fd8a811fb19ed9560bcd13ba6f:create

CREATE INDEX odbvue.idx_crm_survey_responses_author ON
    odbvue.crm_survey_responses (
        author
    );

