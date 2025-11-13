COMMENT ON TABLE odbvue.app_emails IS
    'Table for storing and processing email data';

COMMENT ON COLUMN odbvue.app_emails.attempts IS
    'Number  of sending attempts';

COMMENT ON COLUMN odbvue.app_emails.content IS
    'Email content (HTML)';

COMMENT ON COLUMN odbvue.app_emails.created IS
    'Date and time when created';

COMMENT ON COLUMN odbvue.app_emails.delivered IS
    'Date and time when delivered';

COMMENT ON COLUMN odbvue.app_emails.error IS
    'Error text';

COMMENT ON COLUMN odbvue.app_emails.id IS
    'Primary key';

COMMENT ON COLUMN odbvue.app_emails.postponed IS
    'Date and time until which  not to send again';

COMMENT ON COLUMN odbvue.app_emails.priority IS
    'Email priority (1 - highest .. 9 - lowest)';

COMMENT ON COLUMN odbvue.app_emails.status IS
    'Status (N - not sent,  S - sent, E - error)';

COMMENT ON COLUMN odbvue.app_emails.subject IS
    'Email subject';


-- sqlcl_snapshot {"hash":"2b1a32c0298373a4d684f646b8675b7759c25563","type":"COMMENT","name":"app_emails","schemaName":"odbvue","sxml":""}