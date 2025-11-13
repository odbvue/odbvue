-- liquibase formatted sql
-- changeset odbvue:1763034962065 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_emails_addr.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_emails_addr.sql:null:6cf04e4c211af804f1b30491017b414438ae4243:create

COMMENT ON TABLE odbvue.app_emails_addr IS
    'Table for storing and processing email addresses';

COMMENT ON COLUMN odbvue.app_emails_addr.addr_addr IS
    'Email address';

COMMENT ON COLUMN odbvue.app_emails_addr.addr_name IS
    'Email address name';

COMMENT ON COLUMN odbvue.app_emails_addr.addr_type IS
    'Address type (From, ReplyTo, To, Cc, Bcc)';

COMMENT ON COLUMN odbvue.app_emails_addr.id_email IS
    'Email ID';

