-- liquibase formatted sql
-- changeset ODBVUE:1763708911062 stripComments:false  logicalFilePath:featauth\odbvue\indexes\idx_app_languages_active.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_languages_active.sql:null:90c62caa0ce8fecad9053d29a7dab77e71fff712:create

CREATE INDEX odbvue.idx_app_languages_active ON
    odbvue.app_languages (
        active
    );

