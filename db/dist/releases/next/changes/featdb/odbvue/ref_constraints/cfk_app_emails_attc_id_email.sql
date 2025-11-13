-- liquibase formatted sql
-- changeset ODBVUE:1763034962733 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_emails_attc_id_email.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_emails_attc_id_email.sql:null:5e57bbdf3f6f816305caaa316c7a3c29c748c087:create

ALTER TABLE odbvue.app_emails_attc
    ADD CONSTRAINT cfk_app_emails_attc_id_email
        FOREIGN KEY ( id_email )
            REFERENCES odbvue.app_emails ( id )
        ENABLE;

