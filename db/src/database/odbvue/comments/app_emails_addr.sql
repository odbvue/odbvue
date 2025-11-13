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


-- sqlcl_snapshot {"hash":"6cf04e4c211af804f1b30491017b414438ae4243","type":"COMMENT","name":"app_emails_addr","schemaName":"odbvue","sxml":""}