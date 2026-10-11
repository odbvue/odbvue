import { describe, expect, it } from 'vitest'
import {
  odbEmails,
  odbEmailsPackage,
  emails,
  emailsAddr,
  emailsAttc,
  emailsTypes,
} from '../../../src/index.js'

describe('Emails', () => {
  const sql = odbEmails.toSQLUp({ schema: 'APP' })

  it('installs a queue, constrained recipients, storage attachments and a transport-independent package', () => {
    expect(sql).toContain('CREATE TABLE APP.odb_emails_queue')
    expect(sql).toContain('CREATE TABLE APP.odb_emails_addr')
    expect(sql).toContain('CREATE TABLE APP.odb_emails_attc')
    expect(sql).toContain("status IN ('N', 'S', 'E')")
    expect(sql).toContain('priority BETWEEN 1 AND 5')
    expect(sql).toContain('REFERENCES APP.odb_storage_files (id)')
    expect(sql).toContain('REFERENCES APP.odb_emails_queue (id) ON DELETE CASCADE')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_emails AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY APP.odb_emails AS')
    expect(sql).not.toContain('odb_http')
    expect(odbEmails.types).toBe(emailsTypes)
  })

  it('emits typed calls for composing, addressing, attaching, sending and listing', () => {
    expect(odbEmails.mail('addr', 'name', 'subject', 'html', '3', 'id').toSQL()).toBe(
      'odb_emails.mail(addr, name, subject, html, 3, id)',
    )
    expect(odbEmails.addr('id', "'Cc'", 'addr').toSQL()).toBe(
      "odb_emails.addr(id, 'Cc', addr, NULL)",
    )
    expect(odbEmails.attc('id', 'owner', 'file').toSQL()).toBe('odb_emails.attc(id, owner, file)')
    expect(odbEmails.send('id').toSQL()).toBe('odb_emails.send(id, 300)')
    expect(odbEmails.send('id', '60').toSQL()).toBe('odb_emails.send(id, 60)')
    expect(odbEmails.list('after', 'limit', 'items').toSQL()).toBe(
      'odb_emails.list(after, limit, items)',
    )
    expect(odbEmails.list('after', 'limit', 'items').cursors?.ITEMS).toMatchObject([
      { name: 'id', type: 'guid', nullable: false },
      { name: 'subject', type: 'string', nullable: false },
      { name: 'priority', type: 'number', nullable: false },
      { name: 'status', type: 'string', nullable: false },
      { name: 'created', type: 'timestamp', nullable: false },
      { name: 'delivered', type: 'timestamp', nullable: true },
      { name: 'attempts', type: 'number', nullable: false },
      { name: 'postponed', type: 'timestamp', nullable: true },
      { name: 'error', type: 'string', nullable: true },
    ])
  })

  it('uses the legacy two-argument connection, then STARTTLS before authentication', () => {
    const start = sql.indexOf('UTL_SMTP.OPEN_CONNECTION(l_host, l_port)')
    const tls = sql.indexOf('UTL_SMTP.STARTTLS(l_conn)', start)
    const auth = sql.indexOf(
      "UTL_SMTP.AUTH(l_conn, l_username, l_password, schemes => 'PLAIN')",
      tls,
    )
    expect(start).toBeGreaterThan(0)
    expect(tls).toBeGreaterThan(start)
    expect(auth).toBeGreaterThan(tls)
    expect(sql).not.toMatch(/utl_smtp\.ehlo\(/i)
    expect(sql).not.toContain('secure_host =>')
    expect(sql).toContain('odb_settings.read(p_id, l_value, l_meta)')
    for (const id of [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USERNAME',
      'SMTP_PASSWORD',
      'SMTP_FROM_ADDR',
      'SMTP_FROM_NAME',
    ]) {
      expect(sql).toContain(`smtp_setting('${id}')`)
    }
    expect(sql).not.toContain('JSON_OBJECT_T')
    expect(sql).toContain("REGEXP_LIKE(l_port_value, '^[0-9]{1,5}$')")
    expect(sql).toContain('l_port := TO_NUMBER(l_port_value)')
    expect(sql).toContain('l_port < 1 OR l_port > 65535')
    expect(sql).toContain('EMAILS_SMTP_NOT_CONFIGURED')
    expect(sql).not.toContain('tx_timeout =>')
    expect(sql).not.toContain('wallet_path =>')
    expect(sql).not.toContain('wallet_password =>')
    expect(sql).not.toContain('secure_connection_before_smtp =>')
    expect(sql).not.toContain('walletPath')
  })

  it('encodes UTF-8 HTML and attachments as MIME with bounded base64 lines', () => {
    expect(sql).toContain("odb_lob.clob_to_blob(l_email_content, NLS_CHARSET_ID('AL32UTF8'), 1)")
    expect(sql).not.toContain(
      "odb_lob.clob_to_blob(l_email_content, NLS_CHARSET_ID('AL32UTF8'), TRUE)",
    )
    expect(sql).toContain('DBMS_LOB.SUBSTR(p_blob, 57, l_offset)')
    expect(sql).toContain('l_offset := l_offset + 57')
    expect(sql).toContain('SUBSTR(p_value, l_offset, 9)')
    expect(sql).toContain("'=?UTF-8?B?'")
    expect(sql).toContain('Content-Type: text/html; charset=UTF-8')
    expect(sql).toContain('Content-Transfer-Encoding: base64')
    expect(sql).toContain("line('--' || l_boundary || '--')")
    expect(sql).toContain("line('Content-Disposition: attachment;')")
    expect(sql).toContain('filename*')
    expect(sql).toContain("address_header('ReplyTo', 'Reply-To')")
    expect(sql).not.toContain("address_header('Bcc'")
    expect(sql).toContain("addr_type = 'To' OR addr_type = 'Cc' OR addr_type = 'Bcc'")
  })

  it('guards headers, file ownership, already-sent messages and queue edits', () => {
    expect(sql).toContain("REGEXP_LIKE(p_value, '[[:cntrl:]]')")
    expect(sql).toContain('EMAILS_HEADER_INVALID')
    expect(sql).toContain('EMAILS_ADDRESS_INVALID')
    expect(sql).toContain('EMAILS_SUBJECT_INVALID')
    expect(sql).toContain('EMAILS_CONTENT_REQUIRED')
    expect(sql).toContain('EMAILS_PRIORITY_INVALID')
    expect(sql).toContain('EMAILS_LIMIT_INVALID')
    expect(sql).toContain('odb_storage.read(p_owner_id, p_storage_id')
    expect(sql).toContain('EMAILS_ALREADY_SENT')
    expect(sql).toContain('EMAILS_BUSY')
    expect(sql).toContain('FOR UPDATE NOWAIT')
    expect(sql).toContain('EMAILS_NOT_FOUND')
  })

  it('encodes partial filename chunks without requesting bytes beyond the RAW value', () => {
    expect(sql).toContain(
      "l_filename_hex VARCHAR2(2040) := RAWTOHEX(UTL_I18N.STRING_TO_RAW(p_name, 'AL32UTF8'));",
    )
    expect(sql).toContain('WHILE l_offset <= LENGTH(l_filename_hex) LOOP')
    expect(sql).toContain('l_hex := SUBSTR(l_filename_hex, l_offset, 40);')
    expect(sql).toContain("l_value := l_value || '%' || SUBSTR(l_hex, l_byte * 2 + 1, 2);")
    expect(sql).toContain(
      "CASE WHEN l_offset + 40 <= LENGTH(l_filename_hex) THEN ';' ELSE NULL END",
    )
    expect(sql).toContain('l_offset := l_offset + 40;')
    expect(sql).not.toContain('UTL_RAW.SUBSTR(')
  })

  it('persists failed attempts independently of the HTTP transaction and clears errors on success', () => {
    expect(sql).toContain('PRAGMA AUTONOMOUS_TRANSACTION')
    expect(sql).toContain('SET attempts = attempts + 1')
    expect(sql).toContain("SET status = 'E', error = l_error")
    expect(sql).toContain("NUMTODSINTERVAL(p_postpone, 'SECOND')")
    expect(sql).toContain(
      "SET status = 'S', delivered = SYSTIMESTAMP, postponed = NULL, error = NULL",
    )
    expect(sql).toContain('DBMS_UTILITY.FORMAT_ERROR_BACKTRACE')
    expect(sql).toContain('DBMS_LOB.FREETEMPORARY(l_content)')
    const accepted = sql.indexOf('UTL_SMTP.CLOSE_DATA(l_conn)')
    const saved = sql.indexOf("SET status = 'S'", accepted)
    const committed = sql.indexOf('COMMIT;', saved)
    const quit = sql.indexOf('UTL_SMTP.QUIT(l_conn)', committed)
    expect(saved).toBeGreaterThan(accepted)
    expect(committed).toBeGreaterThan(saved)
    expect(quit).toBeGreaterThan(committed)
  })

  it('defines every routine without raw statements and derives cursor metadata from its query', () => {
    const node = odbEmailsPackage.application()
    expect(JSON.stringify(node)).not.toContain('"kind":"raw"')
    expect(node.procedures.map((proc) => proc.name)).toEqual([
      'mail',
      'addr',
      'attc',
      'list',
      'send',
    ])
    expect(node.procedures.find((proc) => proc.name === 'send')?.autonomous).toBe(true)
    expect(node.procedures.find((proc) => proc.name === 'list')?.body?.resultSets?.P_ITEMS).toEqual(
      odbEmails.list('after', 'limit', 'items').cursors?.ITEMS,
    )
    expect(sql).toContain('PRAGMA EXCEPTION_INIT(e_busy, -54);')
    expect(sql).toMatch(/WHEN OTHERS THEN\s+ROLLBACK;\s+RAISE;/)
    expect(
      sql.indexOf('FUNCTION address(p_addr IN VARCHAR2, p_name IN VARCHAR2) RETURN VARCHAR2;'),
    ).toBeLessThan(
      sql.indexOf('PROCEDURE address_header(p_type IN VARCHAR2, p_header IN VARCHAR2) IS'),
    )
  })

  it('drops dependencies in reverse installation order', () => {
    const down = odbEmails.toSQLDown({ schema: 'APP' })
    const attachment = down.indexOf(emailsAttc.toSQLDown({ schema: 'APP' }))
    const recipient = down.indexOf(emailsAddr.toSQLDown({ schema: 'APP' }))
    const queue = down.indexOf(emails.toSQLDown({ schema: 'APP' }))
    expect(down.indexOf('DROP PACKAGE APP.odb_emails')).toBeLessThan(attachment)
    expect(attachment).toBeLessThan(recipient)
    expect(recipient).toBeLessThan(queue)
  })
})
