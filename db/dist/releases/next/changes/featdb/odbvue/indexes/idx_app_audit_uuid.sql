-- liquibase formatted sql
-- changeset ODBVUE:1762783026322 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_audit_uuid.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_audit_uuid.sql:null:fec927dc25b1e5d702a8accd62ca23ecdec6a093:create

CREATE INDEX odbvue.idx_app_audit_uuid ON
    odbvue.app_audit (
        uuid
    );

