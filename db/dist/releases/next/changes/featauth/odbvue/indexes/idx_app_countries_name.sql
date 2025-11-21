-- liquibase formatted sql
-- changeset ODBVUE:1763708910912 stripComments:false  logicalFilePath:featauth\odbvue\indexes\idx_app_countries_name.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_countries_name.sql:null:6d5e2392d15eabf143a07f5bf2dbff9850417081:create

CREATE INDEX odbvue.idx_app_countries_name ON
    odbvue.app_countries (
        name
    );

