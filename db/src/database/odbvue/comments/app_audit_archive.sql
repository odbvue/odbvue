COMMENT ON TABLE odbvue.app_audit_archive IS
    'Stores archived audit log records.';

COMMENT ON COLUMN odbvue.app_audit_archive.attributes IS
    'A JSON object containing additional attributes for the audit record.';

COMMENT ON COLUMN odbvue.app_audit_archive.created IS
    'The timestamp when the audit record was created.';

COMMENT ON COLUMN odbvue.app_audit_archive.id IS
    'The unique identifier for the audit record.';

COMMENT ON COLUMN odbvue.app_audit_archive.message IS
    'The message content of the audit record.';

COMMENT ON COLUMN odbvue.app_audit_archive.module IS
    'A virtual column extracting the module_name from the attributes JSON object.';

COMMENT ON COLUMN odbvue.app_audit_archive.severity IS
    'The severity text of the audit record.';

COMMENT ON COLUMN odbvue.app_audit_archive.uuid IS
    'A virtual column extracting the uuid from the attributes JSON object.';


-- sqlcl_snapshot {"hash":"0c0f13b3053a68f8b2ef3ffc24d8646447cef7fd","type":"COMMENT","name":"app_audit_archive","schemaName":"odbvue","sxml":""}