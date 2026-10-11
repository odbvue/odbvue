import { describe, expect, it } from 'vitest'
import { odbEmails, emails, emailsAddr, emailsAttc, emailsTypes } from '../../../src/index.js'

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
    const start = sql.indexOf('utl_smtp.open_connection(l_host, l_port)')
    const tls = sql.indexOf('utl_smtp.starttls(l_conn)', start)
    const auth = sql.indexOf(
      "utl_smtp.auth(l_conn, l_username, l_password, schemes => 'PLAIN')",
      tls,
    )
    expect(start).toBeGreaterThan(0)
    expect(tls).toBeGreaterThan(start)
    expect(auth).toBeGreaterThan(tls)
    expect(sql).not.toContain('utl_smtp.ehlo(')
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
    expect(sql).toContain("regexp_like(l_port_value, '^[0-9]{1,5}$')")
    expect(sql).toContain('l_port := to_number(l_port_value)')
    expect(sql).toContain('l_port NOT BETWEEN 1 AND 65535')
    expect(sql).toContain('EMAILS_SMTP_NOT_CONFIGURED')
    expect(sql).not.toContain('tx_timeout =>')
    expect(sql).not.toContain('wallet_path =>')
    expect(sql).not.toContain('wallet_password =>')
    expect(sql).not.toContain('secure_connection_before_smtp =>')
    expect(sql).not.toContain('walletPath')
  })

  it('encodes UTF-8 HTML and attachments as MIME with bounded base64 lines', () => {
    expect(sql).toContain("odb_lob.clob_to_blob(l_email.content, nls_charset_id('AL32UTF8'), 1)")
    expect(sql).not.toContain(
      "odb_lob.clob_to_blob(l_email.content, nls_charset_id('AL32UTF8'), TRUE)",
    )
    expect(sql).toContain('dbms_lob.substr(p_blob, 57, l_offset)')
    expect(sql).toContain('l_offset := l_offset + 57')
    expect(sql).toContain('substr(p_value, l_offset, 9)')
    expect(sql).toContain("'=?UTF-8?B?'")
    expect(sql).toContain('Content-Type: text/html; charset=UTF-8')
    expect(sql).toContain('Content-Transfer-Encoding: base64')
    expect(sql).toContain("line('--' || l_boundary || '--')")
    expect(sql).toContain("line('Content-Disposition: attachment;')")
    expect(sql).toContain('filename*')
    expect(sql).toContain("address_header('ReplyTo', 'Reply-To')")
    expect(sql).not.toContain("address_header('Bcc'")
    expect(sql).toContain("addr_type IN ('To', 'Cc', 'Bcc')")
  })

  it('guards headers, file ownership, already-sent messages and queue edits', () => {
    expect(sql).toContain("regexp_like(p_value, '[[:cntrl:]]')")
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

  it('persists failed attempts independently of the HTTP transaction and clears errors on success', () => {
    expect(sql).toContain('PRAGMA AUTONOMOUS_TRANSACTION')
    expect(sql).toContain('SET attempts = attempts + 1')
    expect(sql).toContain("SET status = 'E', error = l_error")
    expect(sql).toContain("numtodsinterval(p_postpone, 'SECOND')")
    expect(sql).toContain(
      "SET status = 'S', delivered = systimestamp, postponed = NULL, error = NULL",
    )
    expect(sql).toContain('dbms_utility.format_error_backtrace')
    expect(sql).toContain('dbms_lob.freetemporary(l_body)')
    const accepted = sql.indexOf('utl_smtp.close_data(l_conn)')
    const saved = sql.indexOf("SET status = 'S'", accepted)
    const committed = sql.indexOf('COMMIT;', saved)
    const quit = sql.indexOf('utl_smtp.quit(l_conn)', committed)
    expect(saved).toBeGreaterThan(accepted)
    expect(committed).toBeGreaterThan(saved)
    expect(quit).toBeGreaterThan(committed)
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
