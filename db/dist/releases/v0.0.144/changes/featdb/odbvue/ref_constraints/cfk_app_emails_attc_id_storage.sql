-- liquibase formatted sql
-- changeset ODBVUE:1763034962788 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_emails_attc_id_storage.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_emails_attc_id_storage.sql:null:e22d44b3aec78bb67fb661cb58045d00fcf1ec7d:create

ALTER TABLE odbvue.app_emails_attc
    ADD CONSTRAINT cfk_app_emails_attc_id_storage
        FOREIGN KEY ( id_storage )
            REFERENCES odbvue.app_storage ( id )
        ENABLE;

