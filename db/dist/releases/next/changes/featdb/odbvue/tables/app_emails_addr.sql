-- liquibase formatted sql
-- changeset ODBVUE:1763034962952 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_emails_addr.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_emails_addr.sql:null:201570c652130c71e42aea81691b2ecb101b21a1:create

CREATE TABLE odbvue.app_emails_addr (
    id_email  CHAR(32 CHAR) NOT NULL ENABLE,
    addr_type VARCHAR2(7 CHAR) NOT NULL ENABLE,
    addr_addr VARCHAR2(240 CHAR) NOT NULL ENABLE,
    addr_name VARCHAR2(240 CHAR)
);

ALTER TABLE odbvue.app_emails_addr
    ADD CONSTRAINT csc_app_emails_addr_addr_type
        CHECK ( addr_type IN ( 'From', 'ReplyTo', 'To', 'Cc', 'Bcc' ) ) ENABLE;

