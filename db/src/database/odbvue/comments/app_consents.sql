COMMENT ON TABLE odbvue.app_consents IS
    'Table to store user consents for various applications.';

COMMENT ON COLUMN odbvue.app_consents.active IS
    'Indicates whether the consent is active (Y) or inactive (N).';

COMMENT ON COLUMN odbvue.app_consents.content IS
    'Detailed content of the consent.';

COMMENT ON COLUMN odbvue.app_consents.created IS
    'Timestamp when the consent record was created.';

COMMENT ON COLUMN odbvue.app_consents.id IS
    'Unique identifier for each consent record.';

COMMENT ON COLUMN odbvue.app_consents.language_id IS
    'Language identifier for the consent content.';

COMMENT ON COLUMN odbvue.app_consents.name IS
    'Name of the consent.';


-- sqlcl_snapshot {"hash":"80bc67c12fb69885926b549b0531933a3a71f7f7","type":"COMMENT","name":"app_consents","schemaName":"odbvue","sxml":""}