-- liquibase formatted sql
-- changeset ODBVUE:1764755058521 stripComments:false  logicalFilePath:featadmin\odbvue\tables\app_permissions.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_permissions.sql:5feda0e942bc927d4b4eb4e0fbe7f08294784ed9:f4212123b39131042ce5b2a80c355389f42bb4d6:alter

ALTER TABLE odbvue.app_permissions ADD (
    id CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE
);

