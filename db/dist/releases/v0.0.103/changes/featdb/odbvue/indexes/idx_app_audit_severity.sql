-- liquibase formatted sql
-- changeset ODBVUE:1762783026274 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_audit_severity.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_audit_severity.sql:null:c14fe85143be1878c389c7af3cdd4e43f8a5d933:create

CREATE INDEX odbvue.idx_app_audit_severity ON
    odbvue.app_audit (
        severity
    );

