-- liquibase formatted sql
-- changeset ODBVUE:1763034962679 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_emails_addr_id_email.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_emails_addr_id_email.sql:null:f09d2592a83ea8cf7bef7bfe1ad3c3c69812531b:create

ALTER TABLE odbvue.app_emails_addr
    ADD CONSTRAINT cfk_app_emails_addr_id_email
        FOREIGN KEY ( id_email )
            REFERENCES odbvue.app_emails ( id )
        ENABLE;

