-- liquibase formatted sql
-- changeset ODBVUE:1763714036992 stripComments:false  logicalFilePath:featconsents\odbvue\indexes\idx_app_consents_language.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_consents_language.sql:null:f6faa8d6874b836a6458ac193181042ceab8ef17:create

CREATE INDEX odbvue.idx_app_consents_language ON
    odbvue.app_consents (
        language_id
    );

