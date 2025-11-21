-- liquibase formatted sql
-- changeset ODBVUE:1763708910960 stripComments:false  logicalFilePath:featauth\odbvue\indexes\idx_app_currencies_active.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_currencies_active.sql:null:433659ea717e51a927c33a0f56ce854017234e17:create

CREATE INDEX odbvue.idx_app_currencies_active ON
    odbvue.app_currencies (
        active
    );

