CREATE OR REPLACE PACKAGE BODY odb_emails AS
  PROCEDURE invalid(p_code VARCHAR2) AS
  BEGIN
    raise_application_error(-20998, 'ODB_ERROR|VALIDATION_ERROR|' || p_code);
  END;

  PROCEDURE validate_header(p_value VARCHAR2) AS
  BEGIN
    IF regexp_like(p_value, '[[:cntrl:]]') THEN
      invalid('EMAILS_HEADER_INVALID');
    END IF;
  END;

  PROCEDURE validate_address(p_address VARCHAR2, p_name VARCHAR2) AS
  BEGIN
    IF p_address IS NULL OR length(p_address) > 240
       OR NOT regexp_like(p_address, '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$')
       OR length(p_name) > 240 THEN
      invalid('EMAILS_ADDRESS_INVALID');
    END IF;
    validate_header(p_address);
    validate_header(p_name);
  END;

  FUNCTION smtp_setting(p_id VARCHAR2) RETURN VARCHAR2 AS
    l_value VARCHAR2(4000);
    l_meta CLOB;
  BEGIN
    odb_settings.read(p_id, l_value, l_meta);
    RETURN l_value;
  END;

  PROCEDURE mail(
    p_address VARCHAR2, p_name VARCHAR2, p_subject VARCHAR2,
    p_content CLOB, p_priority PLS_INTEGER, p_id OUT VARCHAR2
  ) AS
    l_sender VARCHAR2(240);
    l_name VARCHAR2(240);
  BEGIN
    validate_address(p_address, p_name);
    validate_header(p_subject);
    IF trim(p_subject) IS NULL OR length(p_subject) > 240 THEN
      invalid('EMAILS_SUBJECT_INVALID');
    END IF;
    IF p_content IS NULL OR dbms_lob.getlength(p_content) = 0 THEN
      invalid('EMAILS_CONTENT_REQUIRED');
    END IF;
    IF p_priority IS NULL OR p_priority NOT BETWEEN 1 AND 5 THEN
      invalid('EMAILS_PRIORITY_INVALID');
    END IF;
    l_sender := smtp_setting('SMTP_FROM_ADDR');
    l_name := smtp_setting('SMTP_FROM_NAME');
    IF l_sender IS NULL THEN invalid('EMAILS_SMTP_NOT_CONFIGURED'); END IF;
    validate_address(l_sender, l_name);
    p_id := lower(rawtohex(sys_guid()));
    INSERT INTO odb_emails_queue(id, subject, content, priority)
      VALUES(p_id, trim(p_subject), p_content, p_priority);
    INSERT INTO odb_emails_addr(id_email, addr_type, addr_addr, addr_name)
      VALUES(p_id, 'From', l_sender, l_name);
    INSERT INTO odb_emails_addr(id_email, addr_type, addr_addr, addr_name)
      VALUES(p_id, 'ReplyTo', l_sender, l_name);
    INSERT INTO odb_emails_addr(id_email, addr_type, addr_addr, addr_name)
      VALUES(p_id, 'To', p_address, p_name);
  END;

  PROCEDURE lock_editable(p_id VARCHAR2) AS
    l_status VARCHAR2(1);
  BEGIN
    SELECT status INTO l_status FROM odb_emails_queue WHERE id = p_id FOR UPDATE;
    IF l_status = 'S' THEN
      raise_application_error(-20998, 'ODB_ERROR|CONFLICT|EMAILS_ALREADY_SENT');
    END IF;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      raise_application_error(-20998, 'ODB_ERROR|NOT_FOUND|EMAILS_NOT_FOUND');
  END;

  PROCEDURE addr(p_id VARCHAR2, p_type VARCHAR2, p_address VARCHAR2, p_name VARCHAR2 DEFAULT NULL) AS
  BEGIN
    IF p_type IS NULL OR p_type NOT IN ('ReplyTo', 'To', 'Cc', 'Bcc') THEN
      invalid('EMAILS_ADDRESS_TYPE_INVALID');
    END IF;
    validate_address(p_address, p_name);
    lock_editable(p_id);
    IF p_type = 'ReplyTo' THEN
      DELETE FROM odb_emails_addr WHERE id_email = p_id AND addr_type = 'ReplyTo';
    END IF;
    INSERT INTO odb_emails_addr(id_email, addr_type, addr_addr, addr_name)
      VALUES(p_id, p_type, p_address, p_name);
  END;

  PROCEDURE attc(p_id VARCHAR2, p_owner_id VARCHAR2, p_storage_id VARCHAR2) AS
    l_file_name VARCHAR2(255);
    l_mime_type VARCHAR2(200);
    l_file_size NUMBER;
    l_content BLOB;
    l_meta CLOB;
  BEGIN
    lock_editable(p_id);
    odb_storage.read(p_owner_id, p_storage_id, l_file_name, l_mime_type, l_file_size, l_content, l_meta);
    INSERT INTO odb_emails_attc(id_email, id_storage) VALUES(p_id, p_storage_id);
  END;

  PROCEDURE list(p_after VARCHAR2, p_limit PLS_INTEGER, p_items OUT SYS_REFCURSOR) AS
  BEGIN
    IF p_limit < 1 OR p_limit > 101 THEN
      invalid('EMAILS_LIMIT_INVALID');
    END IF;
    OPEN p_items FOR
      SELECT id, subject, priority, status, created, delivered, attempts, postponed, error
      FROM odb_emails_queue
      WHERE p_after IS NULL OR id > p_after
      ORDER BY id FETCH FIRST nvl(p_limit, 50) ROWS ONLY;
  END;

  PROCEDURE send(p_id VARCHAR2, p_postpone PLS_INTEGER DEFAULT 300) AS
    PRAGMA AUTONOMOUS_TRANSACTION;
    l_email odb_emails_queue%ROWTYPE;
    l_host VARCHAR2(255);
    l_port PLS_INTEGER;
    l_port_value VARCHAR2(4000);
    l_username VARCHAR2(2000);
    l_password VARCHAR2(2000);
    l_conn utl_smtp.connection;
    l_connected BOOLEAN := FALSE;
    l_accepted BOOLEAN := FALSE;
    l_boundary VARCHAR2(80) := 'odb_' || lower(rawtohex(sys_guid()));
    l_body BLOB;
    l_error VARCHAR2(2000);
    l_count PLS_INTEGER;
    e_busy EXCEPTION;
    PRAGMA EXCEPTION_INIT(e_busy, -54);

    PROCEDURE line(p_value VARCHAR2 DEFAULT NULL) AS
    BEGIN
      utl_smtp.write_data(l_conn, p_value || utl_tcp.crlf);
    END;

    FUNCTION encoded(p_value VARCHAR2) RETURN VARCHAR2 AS
      l_result VARCHAR2(4000);
      l_offset PLS_INTEGER := 1;
      l_chunk VARCHAR2(240);
    BEGIN
      -- Nine UTF-8 characters keep each encoded word below RFC 2047's 75-byte limit.
      WHILE l_offset <= length(p_value) LOOP
        l_chunk := substr(p_value, l_offset, 9);
        IF l_offset > 1 THEN l_result := l_result || utl_tcp.crlf || ' '; END IF;
        l_result := l_result || '=?UTF-8?B?' ||
          utl_raw.cast_to_varchar2(utl_encode.base64_encode(utl_i18n.string_to_raw(l_chunk, 'AL32UTF8'))) || '?=';
        l_offset := l_offset + 9;
      END LOOP;
      RETURN l_result;
    END;

    FUNCTION address(p_addr VARCHAR2, p_name VARCHAR2) RETURN VARCHAR2 AS
    BEGIN
      IF p_name IS NULL THEN RETURN '<' || p_addr || '>'; END IF;
      RETURN encoded(p_name) || ' <' || p_addr || '>';
    END;

    PROCEDURE base64(p_blob BLOB) AS
      l_offset PLS_INTEGER := 1;
    BEGIN
      WHILE l_offset <= dbms_lob.getlength(p_blob) LOOP
        line(utl_raw.cast_to_varchar2(utl_encode.base64_encode(dbms_lob.substr(p_blob, 57, l_offset))));
        l_offset := l_offset + 57;
      END LOOP;
    END;

    PROCEDURE free_body AS
    BEGIN
      IF dbms_lob.istemporary(l_body) = 1 THEN dbms_lob.freetemporary(l_body); END IF;
    END;

    PROCEDURE close_connection AS
    BEGIN
      IF l_connected THEN
        utl_tcp.close_connection(l_conn.private_tcp_con);
        l_connected := FALSE;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN
        dbms_output.put_line('EMAILS_CONNECTION_CLEANUP_FAILED: ' || sqlerrm);
    END;

    PROCEDURE address_header(p_type VARCHAR2, p_header VARCHAR2) AS
      l_first BOOLEAN := TRUE;
    BEGIN
      FOR a IN (SELECT addr_addr, addr_name FROM odb_emails_addr WHERE id_email = p_id AND addr_type = p_type ORDER BY addr_addr) LOOP
        utl_smtp.write_data(l_conn,
          CASE WHEN l_first THEN p_header || ': ' ELSE ',' || utl_tcp.crlf || ' ' END ||
          address(a.addr_addr, a.addr_name));
        l_first := FALSE;
      END LOOP;
      IF NOT l_first THEN line(); END IF;
    END;

    PROCEDURE attachment_header(p_name VARCHAR2) AS
      l_raw RAW(1020) := utl_i18n.string_to_raw(p_name, 'AL32UTF8');
      l_hex VARCHAR2(40);
      l_value VARCHAR2(80);
      l_offset PLS_INTEGER := 1;
      l_part PLS_INTEGER := 0;
    BEGIN
      line('Content-Disposition: attachment;');
      WHILE l_offset <= utl_raw.length(l_raw) LOOP
        l_hex := rawtohex(utl_raw.substr(l_raw, l_offset, 20));
        l_value := NULL;
        FOR i IN 0..length(l_hex) / 2 - 1 LOOP
          l_value := l_value || '%' || substr(l_hex, i * 2 + 1, 2);
        END LOOP;
        line(' filename*' || l_part || '*=' ||
          CASE WHEN l_part = 0 THEN 'UTF-8''''' END || l_value ||
          CASE WHEN l_offset + 20 <= utl_raw.length(l_raw) THEN ';' END);
        l_offset := l_offset + 20;
        l_part := l_part + 1;
      END LOOP;
    END;
  BEGIN
    IF p_postpone IS NULL OR p_postpone < 0 THEN invalid('EMAILS_POSTPONE_INVALID'); END IF;
    BEGIN
      SELECT * INTO l_email FROM odb_emails_queue WHERE id = p_id FOR UPDATE NOWAIT;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        raise_application_error(-20998, 'ODB_ERROR|NOT_FOUND|EMAILS_NOT_FOUND');
      WHEN e_busy THEN
        raise_application_error(-20998, 'ODB_ERROR|CONFLICT|EMAILS_BUSY');
    END;
    IF l_email.status = 'S' THEN
      raise_application_error(-20998, 'ODB_ERROR|CONFLICT|EMAILS_ALREADY_SENT');
    END IF;
    UPDATE odb_emails_queue SET attempts = attempts + 1 WHERE id = p_id;
    BEGIN
      l_host := smtp_setting('SMTP_HOST');
      l_port_value := smtp_setting('SMTP_PORT');
      IF l_port_value IS NULL OR NOT regexp_like(l_port_value, '^[0-9]{1,5}$') THEN
        invalid('EMAILS_SMTP_NOT_CONFIGURED');
      END IF;
      l_port := to_number(l_port_value);
      l_username := smtp_setting('SMTP_USERNAME');
      l_password := smtp_setting('SMTP_PASSWORD');
      IF l_host IS NULL OR l_port IS NULL OR l_port NOT BETWEEN 1 AND 65535
         OR l_username IS NULL OR l_password IS NULL THEN
        invalid('EMAILS_SMTP_NOT_CONFIGURED');
      END IF;
      SELECT count(*) INTO l_count FROM odb_emails_addr WHERE id_email = p_id AND addr_type = 'From';
      IF l_count <> 1 THEN invalid('EMAILS_SENDER_INVALID'); END IF;
      SELECT count(*) INTO l_count FROM odb_emails_addr WHERE id_email = p_id AND addr_type IN ('To', 'Cc', 'Bcc');
      IF l_count = 0 THEN invalid('EMAILS_RECIPIENT_REQUIRED'); END IF;
      FOR a IN (SELECT addr_addr, addr_name FROM odb_emails_addr WHERE id_email = p_id) LOOP
        validate_address(a.addr_addr, a.addr_name);
      END LOOP;
      validate_header(l_email.subject);
      l_conn := utl_smtp.open_connection(l_host, l_port);
      l_connected := TRUE;
      utl_smtp.starttls(l_conn);
      utl_smtp.auth(l_conn, l_username, l_password, schemes => 'PLAIN');
      FOR a IN (SELECT addr_addr FROM odb_emails_addr WHERE id_email = p_id AND addr_type = 'From') LOOP
        utl_smtp.mail(l_conn, a.addr_addr);
      END LOOP;
      FOR a IN (SELECT addr_addr FROM odb_emails_addr WHERE id_email = p_id AND addr_type IN ('To', 'Cc', 'Bcc')) LOOP
        utl_smtp.rcpt(l_conn, a.addr_addr);
      END LOOP;
      utl_smtp.open_data(l_conn);
      line('Date: ' || to_char(systimestamp AT TIME ZONE 'UTC', 'Dy, DD Mon YYYY HH24:MI:SS', 'NLS_DATE_LANGUAGE=English') || ' +0000');
      line('Message-ID: <' || p_id || '@odbvue.local>');
      line('Subject: ' || encoded(l_email.subject));
      line('X-Priority: ' || to_char(l_email.priority));
      address_header('From', 'From');
      address_header('ReplyTo', 'Reply-To');
      address_header('To', 'To');
      address_header('Cc', 'Cc');
      line('MIME-Version: 1.0');
      line('Content-Type: multipart/mixed; boundary="' || l_boundary || '"');
      line();
      line('--' || l_boundary);
      line('Content-Type: text/html; charset=UTF-8');
      line('Content-Transfer-Encoding: base64');
      line();
      l_body := odb_lob.clob_to_blob(l_email.content, nls_charset_id('AL32UTF8'), 1);
      base64(l_body);
      free_body();
      FOR a IN (
        SELECT s.file_name, s.mime_type, s.content
        FROM odb_emails_attc a JOIN odb_storage_files s ON s.id = a.id_storage
        WHERE a.id_email = p_id ORDER BY a.id_storage
      ) LOOP
        validate_header(a.file_name);
        validate_header(a.mime_type);
        line('--' || l_boundary);
        line('Content-Type: ' || a.mime_type);
        line('Content-Transfer-Encoding: base64');
        attachment_header(a.file_name);
        line();
        base64(a.content);
      END LOOP;
      line('--' || l_boundary || '--');
      utl_smtp.close_data(l_conn);
      l_accepted := TRUE;
      UPDATE odb_emails_queue SET status = 'S', delivered = systimestamp, postponed = NULL, error = NULL WHERE id = p_id;
      COMMIT;
    EXCEPTION
      WHEN OTHERS THEN
        l_error := substr(sqlerrm || chr(10) || dbms_utility.format_error_backtrace, 1, 2000);
        IF NOT l_accepted THEN
          UPDATE odb_emails_queue SET status = 'E', error = l_error,
            postponed = systimestamp + numtodsinterval(p_postpone, 'SECOND')
          WHERE id = p_id;
          COMMIT;
        END IF;
        free_body();
        close_connection();
        RAISE;
    END;
    -- SMTP accepted DATA already; a failing QUIT must not turn delivery into a retry.
    BEGIN
      utl_smtp.quit(l_conn);
    EXCEPTION
      WHEN OTHERS THEN
        dbms_output.put_line('EMAILS_QUIT_FAILED: ' || sqlerrm);
        close_connection();
    END;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      RAISE;
  END;
END;
/
