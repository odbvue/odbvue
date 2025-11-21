-- liquibase formatted sql
-- changeset ODBVUE:1763714037155 stripComments:false  logicalFilePath:featconsents\odbvue\indexes\idx_app_user_consents_revoked.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_user_consents_revoked.sql:null:1a995612143a22efcebb4812e9c295d31210e140:create

CREATE INDEX odbvue.idx_app_user_consents_revoked ON
    odbvue.app_user_consents (
        revoked
    );

