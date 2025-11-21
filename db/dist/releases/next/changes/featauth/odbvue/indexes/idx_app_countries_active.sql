-- liquibase formatted sql
-- changeset ODBVUE:1763708910859 stripComments:false  logicalFilePath:featauth\odbvue\indexes\idx_app_countries_active.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_countries_active.sql:null:c01ced9a437c81278b902f8692b092cda8a313b9:create

CREATE INDEX odbvue.idx_app_countries_active ON
    odbvue.app_countries (
        active
    );

