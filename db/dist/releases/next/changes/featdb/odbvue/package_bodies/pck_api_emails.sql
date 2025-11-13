-- liquibase formatted sql
-- changeset ODBVUE:1763034962586 stripComments:false  logicalFilePath:featdb\odbvue\package_bodies\pck_api_emails.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_emails.sql:null:f184344bff2a8d743b15f7cce39378527f41e460:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_emails AS

    PROCEDURE mail (
        r_id         OUT app_emails.id%TYPE,
        p_email_addr app_emails_addr.addr_addr%TYPE,
        p_email_name app_emails_addr.addr_name%TYPE,
        p_subject    app_emails.subject%TYPE,
        p_content    app_emails.content%TYPE,
        p_priority   app_emails.priority%TYPE DEFAULT 3
    ) AS

        v_from_addr    app_emails_addr.addr_addr%TYPE := pck_api_settings.read('APP_EMAILS_FROM_ADDR');
        v_from_name    app_emails_addr.addr_name%TYPE := pck_api_settings.read('APP_EMAILS_FROM_NAME');
        v_replyto_addr app_emails_addr.addr_addr%TYPE := pck_api_settings.read('APP_EMAILS_REPLYTO_ADDR');
        v_replyto_name app_emails_addr.addr_name%TYPE := pck_api_settings.read('APP_EMAILS_REPLYTO_NAME');
    BEGIN
        IF ( v_from_addr IS NULL ) THEN
            raise_application_error(-20001, 'Sender email address is not set in settings (APP_EMAILS_FROM_ADDR)');
        END IF;
        IF ( v_replyto_addr IS NULL ) THEN
            raise_application_error(-20002, 'Reply-to email address is not set in settings (APP_EMAILS_REPLYTO_ADDR)');
        END IF;
        INSERT INTO app_emails (
            subject,
            content,
            priority
        ) VALUES ( p_subject,
                   p_content,
                   p_priority ) RETURNING id INTO r_id;

        INSERT INTO app_emails_addr (
            id_email,
            addr_type,
            addr_addr,
            addr_name
        ) VALUES ( r_id,
                   'From',
                   v_from_addr,
                   v_from_name );

        INSERT INTO app_emails_addr (
            id_email,
            addr_type,
            addr_addr,
            addr_name
        ) VALUES ( r_id,
                   'ReplyTo',
                   v_replyto_addr,
                   v_replyto_name );

        INSERT INTO app_emails_addr (
            id_email,
            addr_type,
            addr_addr,
            addr_name
        ) VALUES ( r_id,
                   'To',
                   p_email_addr,
                   p_email_name );

    END;

    PROCEDURE addr (
        p_id         IN OUT app_emails.id%TYPE,
        p_type       app_emails_addr.addr_type%TYPE,
        p_email_addr app_emails_addr.addr_addr%TYPE,
        p_email_name app_emails_addr.addr_name%TYPE
    ) AS
    BEGIN
        INSERT INTO app_emails_addr (
            id_email,
            addr_type,
            addr_addr,
            addr_name
        ) VALUES ( p_id,
                   p_type,
                   p_email_addr,
                   p_email_name );

    END;

    PROCEDURE attc (
        p_id        IN OUT app_emails.id%TYPE,
        p_file_name VARCHAR2,
        p_file_data BLOB
    ) AS
        v_storage_id app_emails_attc.id_storage%TYPE;
    BEGIN
        pck_api_storage.upload(p_file_data, p_file_name, v_storage_id);
        INSERT INTO app_emails_attc (
            id_email,
            id_storage
        ) VALUES ( p_id,
                   v_storage_id );

    END;

    PROCEDURE send (
        p_id       IN OUT app_emails.id%TYPE,
        p_postpone PLS_INTEGER DEFAULT 300
    ) AS

        c_smtp_host VARCHAR2(2000 CHAR);
        c_smtp_port PLS_INTEGER;
        c_smtp_cred VARCHAR2(2000 CHAR);
        v_conn      utl_smtp.connection;
        c_boundary  VARCHAR2(50) := '----=*#abc1234321cba#*=';
        c_blob_mime VARCHAR2(254) := 'text/plain';
        v_chunk     PLS_INTEGER := 57;
        v_len       PLS_INTEGER;
        v_blob      BLOB;
        v_error     VARCHAR2(2000 CHAR);
        v_file_data BLOB;
        v_file_name VARCHAR2(240 CHAR);

        FUNCTION email_encode_utf8 (
            p_value VARCHAR2
        ) RETURN VARCHAR2 AS
        BEGIN
            RETURN replace('=?UTF-8?Q?'
                           || utl_raw.cast_to_varchar2(utl_encode.quoted_printable_encode(utl_raw.cast_to_raw(p_value)))
                           || '?=',
                           '=' || utl_tcp.crlf,
                           '');
        END;

        FUNCTION email_format_address (
            p_addr VARCHAR2,
            p_name VARCHAR2
        ) RETURN VARCHAR2 AS
        BEGIN
            IF p_name IS NOT NULL THEN
                RETURN ( '"'
                         || email_encode_utf8(p_name)
                         || '"<'
                         || p_addr || '>' );

            ELSE
                RETURN ( '<'
                         || p_addr || '>' );
            END IF;
        END;

        FUNCTION clob_to_blob (
            value            IN CLOB,
            charset_id       IN INTEGER DEFAULT dbms_lob.default_csid,
            error_on_warning IN NUMBER DEFAULT 0
        ) RETURN BLOB IS

            result       BLOB;
            dest_offset  INTEGER := 1;
            src_offset   INTEGER := 1;
            lang_context INTEGER := dbms_lob.default_lang_ctx;
            warning      INTEGER;
            warning_msg  VARCHAR2(50);
        BEGIN
            dbms_lob.createtemporary(
                lob_loc => result,
                cache   => TRUE
            );
            dbms_lob.converttoblob(
                dest_lob     => result,
                src_clob     => value,
                amount       => length(value),
                dest_offset  => dest_offset,
                src_offset   => src_offset,
                blob_csid    => charset_id,
                lang_context => lang_context,
                warning      => warning
            );

            IF warning != dbms_lob.no_warning THEN
                IF warning = dbms_lob.warn_inconvertible_char THEN
                    warning_msg := 'Warning: Inconvertible character.';
                ELSE
                    warning_msg := 'Warning: ('
                                   || warning
                                   || ') during CLOB conversion.';
                END IF;

                IF error_on_warning = 0 THEN
                    dbms_output.put_line(warning_msg);
                ELSE
                    raise_application_error(-20567, -- random value between -20000 and -20999
                     warning_msg);
                END IF;

            END IF;

            RETURN result;
        END clob_to_blob;

    BEGIN
        c_smtp_host := pck_api_settings.read('APP_EMAILS_SMTP_HOST');
        c_smtp_port := TO_NUMBER ( pck_api_settings.read('APP_EMAILS_SMTP_PORT') );
        c_smtp_cred := pck_api_settings.read('APP_EMAILS_SMTP_CRED');
        IF c_smtp_host IS NULL THEN
            raise_application_error(-20003, 'SMTP host is not set in settings (APP_EMAILS_SMTP_HOST)');
        END IF;
        IF c_smtp_port IS NULL THEN
            raise_application_error(-20004, 'SMTP port is not set in settings (APP_EMAILS_SMTP_PORT)');
        END IF;
        IF c_smtp_cred IS NULL THEN
            raise_application_error(-20005, 'SMTP credentials are not set in settings (APP_EMAILS_SMTP_CRED)');
        END IF;
        FOR e IN (
            SELECT
                id,
                subject,
                content
            FROM
                app_emails
            WHERE
                id = p_id
        ) LOOP
            BEGIN
                v_conn := utl_smtp.open_connection(c_smtp_host, c_smtp_port);
                utl_smtp.starttls(v_conn);
                utl_smtp.set_credential(v_conn, c_smtp_cred,
                                        schemes => 'PLAIN');
                FOR a IN (
                    SELECT
                        addr_addr
                    FROM
                        app_emails_addr
                    WHERE
                            id_email = e.id
                        AND addr_type = 'From'
                ) LOOP
                    utl_smtp.mail(v_conn, a.addr_addr);
                END LOOP;

                FOR a IN (
                    SELECT
                        addr_addr
                    FROM
                        app_emails_addr
                    WHERE
                            id_email = e.id
                        AND addr_type IN ( 'To', 'Cc', 'Bcc' )
                ) LOOP
                    utl_smtp.rcpt(v_conn, a.addr_addr);
                END LOOP;

                utl_smtp.open_data(v_conn);
                utl_smtp.write_data(v_conn,
                                    'Date: '
                                    || to_char(sysdate, 'DD-MON-YYYY HH24:MI:SS')
                                    || utl_tcp.crlf);

                utl_smtp.write_data(v_conn,
                                    'Subject: '
                                    || email_encode_utf8(e.subject)
                                    || utl_tcp.crlf);

                FOR a IN (
                    SELECT
                        addr_type,
                        addr_addr,
                        addr_name
                    FROM
                        app_emails_addr
                    WHERE
                        id_email = e.id
                ) LOOP
                    utl_smtp.write_data(v_conn,
                                        a.addr_type
                                        || ': '
                                        || email_format_address(a.addr_addr, a.addr_name)
                                        || utl_tcp.crlf);
                END LOOP;

                utl_smtp.write_data(v_conn, 'MIME-version: 1.0');
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, 'Content-Type: multipart/mixed; boundary="'
                                            || c_boundary
                                            || '"');
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, '--' || c_boundary);
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, 'Content-Type: text/html; charset = "utf-8"');
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, 'Content-Transfer-Encoding: base64');
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                v_len := dbms_lob.getlength(e.content);
                IF v_len < 2000 THEN
                    utl_smtp.write_raw_data(v_conn,
                                            utl_encode.base64_encode(utl_raw.cast_to_raw(e.content))); -- ??? CLOB
                ELSE
                    v_blob := clob_to_blob(e.content);
                    FOR i IN 0..trunc((dbms_lob.getlength(v_blob) - 1) / v_chunk) LOOP
                        utl_smtp.write_data(v_conn,
                                            utl_raw.cast_to_varchar2(utl_encode.base64_encode(dbms_lob.substr(v_blob, v_chunk, i * v_chunk
                                            + 1))));
                    END LOOP;

                END IF;

                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                utl_smtp.write_data(v_conn, utl_tcp.crlf);
                FOR a IN (
                    SELECT
                        id_storage -- file_data, file_name
                    FROM
                        app_emails_attc
                    WHERE
                        id_email = p_id
                    ORDER BY
                        id_storage
                ) LOOP
                    pck_api_storage.download(a.id_storage, v_file_data, v_file_name);
                    utl_smtp.write_data(v_conn, '--'
                                                || c_boundary
                                                || utl_tcp.crlf);
                    utl_smtp.write_data(v_conn,
                                        'Content-Type: '
                                        || c_blob_mime
                                        || '; name="'
                                        || email_encode_utf8(v_file_name)
                                        || '"'
                                        || utl_tcp.crlf);

                    utl_smtp.write_data(v_conn, 'Content-Transfer-Encoding: base64' || utl_tcp.crlf);
                    utl_smtp.write_data(v_conn,
                                        'Content-Disposition: attachment; filename="'
                                        || email_encode_utf8(v_file_name)
                                        || '"'
                                        || utl_tcp.crlf
                                        || utl_tcp.crlf);

                    FOR i IN 0..trunc((dbms_lob.getlength(v_file_data) - 1) / v_chunk) LOOP
                        utl_smtp.write_data(v_conn,
                                            utl_raw.cast_to_varchar2(utl_encode.base64_encode(dbms_lob.substr(v_file_data, v_chunk, i * v_chunk
                                            + 1))));
                    END LOOP;

                    utl_smtp.write_data(v_conn, utl_tcp.crlf || utl_tcp.crlf);
                END LOOP;

                utl_smtp.write_data(v_conn, '--'
                                            || c_boundary
                                            || '--'
                                            || utl_tcp.crlf);

                utl_smtp.close_data(v_conn);
                utl_smtp.quit(v_conn);
                UPDATE app_emails
                SET
                    status = 'S',
                    delivered = systimestamp
                WHERE
                    id = p_id;

                COMMIT;
            EXCEPTION
                WHEN OTHERS THEN
                    v_error := '('
                               || sqlcode
                               || ') '
                               || trim(substr(sqlerrm, 1, 254))
                               || ' '
                               || trim(substr(dbms_utility.format_error_stack, 1, 512))
                               || ' '
                               || trim(substr(dbms_utility.format_error_backtrace, 1, 512));

                    UPDATE app_emails
                    SET
                        status = 'E',
                        attempts = attempts + 1,
                        postponed = systimestamp + p_postpone / 84600,
                        error = v_error
                    WHERE
                        id = p_id;

                    COMMIT;
                    dbms_output.put_line('!!!' || v_error);
                    utl_smtp.quit(v_conn);
                    RAISE;
            END;
        END LOOP;

    END;

END;
/

