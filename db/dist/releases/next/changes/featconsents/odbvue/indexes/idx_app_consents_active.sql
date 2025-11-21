-- liquibase formatted sql
-- changeset ODBVUE:1763714036940 stripComments:false  logicalFilePath:featconsents\odbvue\indexes\idx_app_consents_active.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_consents_active.sql:null:2ec301cdb190759c6eac97dbe74a86956b8c5e38:create

CREATE INDEX odbvue.idx_app_consents_active ON
    odbvue.app_consents (
        active
    );

