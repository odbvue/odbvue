-- liquibase formatted sql
-- changeset odbvue:1763119013115 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_roles.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_roles.sql:null:88a90d400c3664ab57ba029833078c2711573246:create

COMMENT ON TABLE odbvue.app_roles IS
    'Table for storing user roles';

COMMENT ON COLUMN odbvue.app_roles.description IS
    'Role description';

COMMENT ON COLUMN odbvue.app_roles.id IS
    'Role id';

COMMENT ON COLUMN odbvue.app_roles.role IS
    'Role name';

