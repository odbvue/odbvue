-- liquibase formatted sql
-- changeset ODBVUE:1763714037046 stripComments:false  logicalFilePath:featconsents\odbvue\indexes\idx_app_user_consents_consent.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_user_consents_consent.sql:null:12319c7634e010cc26510e3d1af215f7732098d7:create

CREATE INDEX odbvue.idx_app_user_consents_consent ON
    odbvue.app_user_consents (
        consent_id
    );

