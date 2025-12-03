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


-- sqlcl_snapshot {"hash":"9e8b695908371d87eaf4433275b3098ff1cd8f93","type":"COMMENT","name":"app_permissions","schemaName":"odbvue","sxml":""}