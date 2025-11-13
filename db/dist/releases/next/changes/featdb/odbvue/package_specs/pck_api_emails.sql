-- liquibase formatted sql
-- changeset ODBVUE:1763034962626 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_emails.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_emails.sql:null:2c980a71407dafe62fbc4b3e29c7146dd46cbce4:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_emails -- Package for sending emails
 AS
    PROCEDURE mail ( -- Create a new email
        r_id         OUT app_emails.id%TYPE, -- Email ID
        p_email_addr app_emails_addr.addr_addr%TYPE, -- Email address
        p_email_name app_emails_addr.addr_name%TYPE, -- Email name
        p_subject    app_emails.subject%TYPE, -- Email subject
        p_content    app_emails.content%TYPE, -- Email content
        p_priority   app_emails.priority%TYPE DEFAULT 3 -- Email priority (1..10)
    );

    PROCEDURE addr ( -- Add an email address to the email
        p_id         IN OUT app_emails.id%TYPE, -- Email ID
        p_type       app_emails_addr.addr_type%TYPE, -- Email address type (From, ReplyTo, To, Cc, Bcc)
        p_email_addr app_emails_addr.addr_addr%TYPE, -- Email address
        p_email_name app_emails_addr.addr_name%TYPE -- Email addressee name
    );

    PROCEDURE attc ( -- Add an attachment to the email
        p_id        IN OUT app_emails.id%TYPE, -- Email ID
        p_file_name VARCHAR2, -- Attachment file name
        p_file_data BLOB -- Attachment file data
    );

    PROCEDURE send ( -- Send the email
        p_id       IN OUT app_emails.id%TYPE, -- Email ID
        p_postpone PLS_INTEGER DEFAULT 300 -- Postpone sending the email (seconds)
    );

END;
/

