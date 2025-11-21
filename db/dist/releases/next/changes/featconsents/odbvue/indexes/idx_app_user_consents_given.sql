-- liquibase formatted sql
-- changeset ODBVUE:1763714037100 stripComments:false  logicalFilePath:featconsents\odbvue\indexes\idx_app_user_consents_given.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_user_consents_given.sql:null:414bd49fb3cc9151ee1a7e56399c41dbd8fbf919:create

CREATE INDEX odbvue.idx_app_user_consents_given ON
    odbvue.app_user_consents (
        given
    );

