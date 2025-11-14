-- liquibase formatted sql
-- changeset odbvue:1763119013056 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_permissions.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_permissions.sql:null:1898f3222dcee44b02bd996a864cc2c76ceb4b69:create

COMMENT ON TABLE odbvue.app_permissions IS
    'Table for storing user permissions';

COMMENT ON COLUMN odbvue.app_permissions.id_role IS
    'Role id';

COMMENT ON COLUMN odbvue.app_permissions.id_user IS
    'User id';

COMMENT ON COLUMN odbvue.app_permissions.permission IS
    'Permission details';

COMMENT ON COLUMN odbvue.app_permissions.valid_from IS
    'Validity period from';

COMMENT ON COLUMN odbvue.app_permissions.valid_to IS
    'Validity period to';

