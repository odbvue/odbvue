-- liquibase formatted sql
-- changeset ODBVUE:1764755056209 stripComments:false  logicalFilePath:featadmin\odbvue\indexes\idx_app_permissions_id.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_permissions_id.sql:null:c6956648bbc7e9000de65e45ed765045de52ac92:create

CREATE INDEX odbvue.idx_app_permissions_id ON
    odbvue.app_permissions (
        id
    );

