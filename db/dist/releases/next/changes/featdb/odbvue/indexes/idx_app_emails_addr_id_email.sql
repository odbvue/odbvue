-- liquibase formatted sql
-- changeset ODBVUE:1763034962176 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_emails_addr_id_email.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_emails_addr_id_email.sql:null:6e6b67151cebf6ee22e232db13bf3b9ea6830eb5:create

CREATE INDEX odbvue.idx_app_emails_addr_id_email ON
    odbvue.app_emails_addr (
        id_email
    );

