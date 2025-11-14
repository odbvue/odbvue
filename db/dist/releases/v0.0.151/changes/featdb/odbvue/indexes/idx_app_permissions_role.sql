-- liquibase formatted sql
-- changeset ODBVUE:1763119013387 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_permissions_role.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_permissions_role.sql:null:27ff36dfd9d1dce52fae96cf1de947deea1d6f2f:create

CREATE INDEX odbvue.idx_app_permissions_role ON
    odbvue.app_permissions (
        id_role
    );

