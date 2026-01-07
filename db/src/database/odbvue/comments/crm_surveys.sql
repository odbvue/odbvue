COMMENT ON TABLE odbvue.crm_surveys IS
    'Table for storing survey definitions';

COMMENT ON COLUMN odbvue.crm_surveys.active IS
    'Whether survey is currently active (Y/N) - computed';

COMMENT ON COLUMN odbvue.crm_surveys.author IS
    'User UUID who created the survey. Reference to APP_USERS.UUID';

COMMENT ON COLUMN odbvue.crm_surveys.code IS
    'Unique survey code - hex representation of id';

COMMENT ON COLUMN odbvue.crm_surveys.created IS
    'Timestamp when survey was created';

COMMENT ON COLUMN odbvue.crm_surveys.description IS
    'Survey description';

COMMENT ON COLUMN odbvue.crm_surveys.editor IS
    'User UUID who last edited the survey. Reference to APP_USERS.UUID';

COMMENT ON COLUMN odbvue.crm_surveys.id IS
    'Primary key - auto generated';

COMMENT ON COLUMN odbvue.crm_surveys.title IS
    'Survey title';

COMMENT ON COLUMN odbvue.crm_surveys.updated IS
    'Timestamp when survey was last updated';

COMMENT ON COLUMN odbvue.crm_surveys.valid_from IS
    'Survey validity start date';

COMMENT ON COLUMN odbvue.crm_surveys.valid_to IS
    'Survey validity end date';


-- sqlcl_snapshot {"hash":"c540c3a15f2415ca41274dc86da8f52bfb51f489","type":"COMMENT","name":"crm_surveys","schemaName":"odbvue","sxml":""}