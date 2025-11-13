-- liquibase formatted sql
-- changeset ODBVUE:1763018047124 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_storage_s3_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_storage_s3_created.sql:null:dcf71132bb04878f7aca468e35324194bdfa956c:create

CREATE INDEX odbvue.idx_app_storage_s3_created ON
    odbvue.app_storage (
        s3_created
    );

