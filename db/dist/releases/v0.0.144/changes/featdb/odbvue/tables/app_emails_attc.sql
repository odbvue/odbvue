-- liquibase formatted sql
-- changeset ODBVUE:1763034963018 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_emails_attc.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_emails_attc.sql:null:1e7057fc47f15200f1a910a1056b51734ab5db9b:create

CREATE TABLE odbvue.app_emails_attc (
    id_email   CHAR(32 CHAR) NOT NULL ENABLE,
    id_storage CHAR(32 CHAR) NOT NULL ENABLE
);

ALTER TABLE odbvue.app_emails_attc
    ADD CONSTRAINT cpk_app_emails_attc PRIMARY KEY ( id_email,
                                                     id_storage )
        USING INDEX ENABLE;

