-- liquibase formatted sql
-- changeset odbvue:1762783026068 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_audit.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_audit.sql:null:f24e7f6d9c3d36373b4bd290e97435b3c610b4d3:create

COMMENT ON TABLE odbvue.app_audit IS
    'Stores audit log records.';

COMMENT ON COLUMN odbvue.app_audit.attributes IS
    'A JSON object containing additional attributes for the audit record.';

COMMENT ON COLUMN odbvue.app_audit.created IS
    'The timestamp when the audit record was created.';

COMMENT ON COLUMN odbvue.app_audit.id IS
    'The unique identifier for the audit record.';

COMMENT ON COLUMN odbvue.app_audit.message IS
    'The message content of the audit record.';

COMMENT ON COLUMN odbvue.app_audit.module IS
    'A virtual column extracting the module_name from the attributes JSON object.';

COMMENT ON COLUMN odbvue.app_audit.severity IS
    'The severity text of the audit record.';

COMMENT ON COLUMN odbvue.app_audit.uuid IS
    'A virtual column extracting the uuid from the attributes JSON object.';

