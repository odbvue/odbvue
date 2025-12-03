-- liquibase formatted sql
-- changeset  SqlCl:1764743828227 stripComments:false logicalFilePath:featadmin\_custom\010_dev_role.sql
-- sqlcl_snapshot dist\releases\next\changes\featadmin\_custom\010_dev_role.sql:null:null:custom


MERGE INTO app_roles dest
USING (SELECT 'DEVELOPER' AS role,
              'Developers Role' AS description
       FROM dual) src
ON (dest.role = src.role)
WHEN MATCHED THEN
  UPDATE SET dest.description = src.description
WHEN NOT MATCHED THEN
  INSERT (role, description)
  VALUES (src.role, src.description);

