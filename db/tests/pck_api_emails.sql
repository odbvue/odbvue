DECLARE
    v_id app_emails.id%TYPE;
BEGIN

    IF pck_api_settings.read('APP_EMAILS_SMTP_USERNAME') IS NULL OR pck_api_settings.read('APP_EMAILS_SMTP_PASSWORD') IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'SMTP Credentials not set up!');
    END IF;

    pck_api_emails.mail(v_id, 'admin@odbvue.com', 'Admin User', 'Test email 123', 'This is a <b>test</b> email!');
    pck_api_emails.send(v_id);
END;
/
