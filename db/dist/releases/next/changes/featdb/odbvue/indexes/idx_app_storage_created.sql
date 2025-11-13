-- liquibase formatted sql
-- changeset ODBVUE:1763018047066 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_storage_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_storage_created.sql:null:3b7d7e7120ad141e3f355f508652851dd7e3b5d7:create

CREATE INDEX odbvue.idx_app_storage_created ON
    odbvue.app_storage (
        created
    );

