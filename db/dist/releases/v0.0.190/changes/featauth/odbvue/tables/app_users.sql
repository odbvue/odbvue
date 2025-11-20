-- liquibase formatted sql
-- changeset ODBVUE:1763641553374 stripComments:false  logicalFilePath:featauth\odbvue\tables\app_users.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_users.sql:11fa8228660a69e28416ad382e3fd726a04ac0c9:fc7d5b53bd5b7263c115c5f0fbd73ded08101e0c:alter

ALTER TABLE odbvue.app_users ADD (
    attempted TIMESTAMP(6)
);

