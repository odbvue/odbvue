-- liquibase formatted sql
-- changeset ODBVUE:1762783026183 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_audit_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_audit_created.sql:null:97b09ed8a3b604c25f15513d20c810c849bf93e4:create

CREATE INDEX odbvue.idx_app_audit_created ON
    odbvue.app_audit (
        created
    );

