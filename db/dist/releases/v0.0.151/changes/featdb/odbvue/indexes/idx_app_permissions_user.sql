-- liquibase formatted sql
-- changeset ODBVUE:1763119013438 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_permissions_user.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_permissions_user.sql:null:d028ae7fe5893316183d72f7df9cb0fc2cbc0f67:create

CREATE INDEX odbvue.idx_app_permissions_user ON
    odbvue.app_permissions (
        id_user
    );

