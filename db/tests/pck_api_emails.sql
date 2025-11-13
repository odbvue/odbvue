BEGIN
    -- smtp settings
    pck_api_settings.write('APP_EMAILS_SMTP_HOST', 'SMTP Host', 'smtp.email.eu-stockholm-1.oci.oraclecloud.com');
    pck_api_settings.write('APP_EMAILS_SMTP_PORT', 'SMTP Port', '587');

    pck_api_settings.write('APP_EMAILS_SMTP_CRED', 'SMTP Credentials', 'APP_EMAILS_SMTP_CRED');
    -- sender
    pck_api_settings.write('APP_EMAILS_FROM_ADDR', 'Default Address for Email Sender', 'admin@odbvue.com');
    pck_api_settings.write('APP_EMAILS_FROM_NAME', 'Default Name for Email Sender', 'admin@odbvue.com');
    -- reply to
    pck_api_settings.write('APP_EMAILS_REPLYTO_ADDR', 'Default Address for Email Reply', 'admin@odbvue.com');
    pck_api_settings.write('APP_EMAILS_REPLYTO_NAME', 'Default Name for Email Reply', 'admin@odbvue.com');
    --
    COMMIT;
END;
/

DECLARE
    v_id app_emails.id%TYPE;
BEGIN

    IF pck_api_settings.read('APP_EMAILS_SMTP_CRED') IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'SMTP Credentials not set up!');
    END IF;

    pck_api_emails.mail(v_id, 'admin@odbvue.com', 'Admin', 'Test email 123', 'This is a <b>test</b> email!');
    pck_api_emails.send(v_id);
END;
/
