-- liquibase formatted sql
-- changeset ODBVUE:1763714037330 stripComments:false  logicalFilePath:featconsents\odbvue\ref_constraints\cfk_app_consents_language.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_consents_language.sql:null:23a5b293a135334b55b173a34799b1e5bcb0635d:create

ALTER TABLE odbvue.app_consents
    ADD CONSTRAINT cfk_app_consents_language
        FOREIGN KEY ( language_id )
            REFERENCES odbvue.app_languages ( id )
        ENABLE;

