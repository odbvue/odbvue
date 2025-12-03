-- liquibase formatted sql
-- changeset  SqlCl:1764743828227 stripComments:false logicalFilePath:featadmin\_custom\010_dev_role.sql
-- sqlcl_snapshot dist\releases\next\changes\featadmin\_custom\010_dev_role.sql:null:null:custom


INSERT INTO app_roles (role, description)
SELECT 'DEVELOPER' AS role,
       'Developers Role' AS description 
FROM dual
WHERE NOT EXISTS (SELECT 1 
                  FROM app_roles 
                  WHERE role = 'DEVELOPER');


