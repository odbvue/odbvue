-- liquibase formatted sql
-- changeset odbvue:1763034962117 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_emails_attc.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_emails_attc.sql:null:e415dec9b26c9f13c5dafbc71b444af5274225e9:create

COMMENT ON TABLE odbvue.app_emails_attc IS
    'Table for storing and processing email attachments';

COMMENT ON COLUMN odbvue.app_emails_attc.id_email IS
    'Email ID';

COMMENT ON COLUMN odbvue.app_emails_attc.id_storage IS
    'Attachment storage ID';

