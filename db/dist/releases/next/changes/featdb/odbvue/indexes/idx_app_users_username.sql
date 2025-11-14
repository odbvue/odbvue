-- liquibase formatted sql
-- changeset ODBVUE:1763119013574 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_users_username.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_users_username.sql:null:2ece5355c3e17826faec2de75798c84be7b7a894:create

CREATE UNIQUE INDEX odbvue.idx_app_users_username ON
    odbvue.app_users (
        username
    );

