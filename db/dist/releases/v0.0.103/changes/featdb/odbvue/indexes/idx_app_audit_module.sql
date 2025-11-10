-- liquibase formatted sql
-- changeset ODBVUE:1762783026230 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_audit_module.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_audit_module.sql:null:ee495a558dc878d21fb8fe9c51e2a35a57353eef:create

CREATE INDEX odbvue.idx_app_audit_module ON
    odbvue.app_audit (
        module
    );

