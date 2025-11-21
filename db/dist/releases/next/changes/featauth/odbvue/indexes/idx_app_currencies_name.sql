-- liquibase formatted sql
-- changeset ODBVUE:1763708911010 stripComments:false  logicalFilePath:featauth\odbvue\indexes\idx_app_currencies_name.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_currencies_name.sql:null:8ad252986d77cc73453202761f9eb4617e10a304:create

CREATE INDEX odbvue.idx_app_currencies_name ON
    odbvue.app_currencies (
        name
    );

