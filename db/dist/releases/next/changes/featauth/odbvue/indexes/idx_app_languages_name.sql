-- liquibase formatted sql
-- changeset ODBVUE:1763708911114 stripComments:false  logicalFilePath:featauth\odbvue\indexes\idx_app_languages_name.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_languages_name.sql:null:2e9e3b69865318b2534fe670ca0719189028ebde:create

CREATE INDEX odbvue.idx_app_languages_name ON
    odbvue.app_languages (
        name
    );

