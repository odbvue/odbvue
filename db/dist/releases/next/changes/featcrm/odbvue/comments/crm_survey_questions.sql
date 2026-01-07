-- liquibase formatted sql
-- changeset odbvue:1767794233584 stripComments:false  logicalFilePath:featcrm\odbvue\comments\crm_survey_questions.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/crm_survey_questions.sql:null:4c3167f7f9ec72d0430a1a94b70a33bcceed2cb2:create

COMMENT ON TABLE odbvue.crm_survey_questions IS
    'Table for storing survey questions';

COMMENT ON COLUMN odbvue.crm_survey_questions.id IS
    'Primary key - auto generated';

COMMENT ON COLUMN odbvue.crm_survey_questions.position IS
    'Position of question in survey';

COMMENT ON COLUMN odbvue.crm_survey_questions.question IS
    'Question text in markdown format. For choice types, choices are separated by newlines';

COMMENT ON COLUMN odbvue.crm_survey_questions.required IS
    'Whether question requires an answer (Y/N)';

COMMENT ON COLUMN odbvue.crm_survey_questions.survey_id IS
    'Reference to crm_surveys.id';

COMMENT ON COLUMN odbvue.crm_survey_questions.type IS
    'Question type: free text, number, single choice, multiple choices, rating 5, none';

