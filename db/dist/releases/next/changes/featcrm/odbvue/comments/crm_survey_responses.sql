-- liquibase formatted sql
-- changeset odbvue:1767794233658 stripComments:false  logicalFilePath:featcrm\odbvue\comments\crm_survey_responses.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/crm_survey_responses.sql:null:1c93dc6d83b4dd3dab1177e8b8c421e661a973e8:create

COMMENT ON TABLE odbvue.crm_survey_responses IS
    'Table for storing survey responses';

COMMENT ON COLUMN odbvue.crm_survey_responses.author IS
    'User UUID who submitted the response. Reference to APP_USERS.UUID';

COMMENT ON COLUMN odbvue.crm_survey_responses.created IS
    'Timestamp when response was submitted';

COMMENT ON COLUMN odbvue.crm_survey_responses.id IS
    'Primary key - auto generated';

COMMENT ON COLUMN odbvue.crm_survey_responses.responses IS
    'JSON array of responses: [{id, answer},..]';

COMMENT ON COLUMN odbvue.crm_survey_responses.survey_id IS
    'Reference to crm_surveys.id';

