-- liquibase formatted sql
-- changeset odbvue:1764755056585 stripComments:false  logicalFilePath:featadmin\odbvue\comments\app_permissions.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_permissions.sql:1898f3222dcee44b02bd996a864cc2c76ceb4b69:9e8b695908371d87eaf4433275b3098ff1cd8f93:alter

COMMENT ON TABLE odbvue.app_permissions IS
    'Table for storing user permissions';

COMMENT ON COLUMN odbvue.app_permissions.id IS
    'Unique identifier for the permission record';

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

