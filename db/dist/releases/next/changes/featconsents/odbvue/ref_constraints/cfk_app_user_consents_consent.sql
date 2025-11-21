-- liquibase formatted sql
-- changeset ODBVUE:1763714037383 stripComments:false  logicalFilePath:featconsents\odbvue\ref_constraints\cfk_app_user_consents_consent.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_user_consents_consent.sql:null:02b5a5ea77c8d4691492cdda706f12022f6249c5:create

ALTER TABLE odbvue.app_user_consents
    ADD CONSTRAINT cfk_app_user_consents_consent
        FOREIGN KEY ( consent_id )
            REFERENCES odbvue.app_consents ( id )
        ENABLE;

