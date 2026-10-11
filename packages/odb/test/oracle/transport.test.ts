import { describe, expect, it } from 'vitest'
import {
  odbDbmsOutput,
  odbDbmsUtility,
  odbOracle,
  odbUtlSmtp,
  odbUtlTcp,
} from '../../src/oracle/index.js'
import { odbLiteral } from '../../src/schema/attribute.js'
import { odbPackage } from '../../src/schema/package.js'

describe('Oracle transport and diagnostic wrappers', () => {
  it('renders SMTP calls and connection records without creating import cycles', () => {
    const pkg = odbPackage('transport', (p) => ({
      send: p.proc('send', {}, ({ body }) => {
        const { conn } = body.variables({ conn: odbUtlSmtp.connection })
        body.set(conn, odbUtlSmtp.openConnection(odbLiteral('smtp.example.com'), odbLiteral(587)))
        body.call(odbUtlSmtp.startTls(conn))
        body.call(
          odbUtlSmtp.auth(conn, odbLiteral('user'), odbLiteral("p'ass"), odbLiteral('PLAIN')),
        )
        body.call(
          odbUtlTcp.closeConnection(conn.field('private_tcp_con', odbUtlTcp.connection.type)),
        )
      }),
    }))
    const sql = pkg.toSQLUp()
    expect(sql).toContain('l_conn UTL_SMTP.CONNECTION;')
    expect(sql).toContain("UTL_SMTP.OPEN_CONNECTION('smtp.example.com', 587)")
    expect(sql).toContain('UTL_SMTP.STARTTLS(l_conn)')
    expect(sql).toContain("UTL_SMTP.AUTH(l_conn, 'user', 'p''ass', schemes => 'PLAIN')")
    expect(sql).toContain('UTL_TCP.CLOSE_CONNECTION(l_conn.private_tcp_con)')
    expect(odbUtlTcp.CRLF.toSQL()).toBe('UTL_TCP.CRLF')
    expect(odbUtlSmtp.mail('conn', 'address').toSQL()).toBe('UTL_SMTP.MAIL(conn, address)')
    expect(odbUtlSmtp.rcpt('conn', 'address').toSQL()).toBe('UTL_SMTP.RCPT(conn, address)')
    expect(odbUtlSmtp.openData('conn').toSQL()).toBe('UTL_SMTP.OPEN_DATA(conn)')
    expect(odbUtlSmtp.writeData('conn', 'data').toSQL()).toBe('UTL_SMTP.WRITE_DATA(conn, data)')
    expect(odbUtlSmtp.closeData('conn').toSQL()).toBe('UTL_SMTP.CLOSE_DATA(conn)')
    expect(odbUtlSmtp.quit('conn').toSQL()).toBe('UTL_SMTP.QUIT(conn)')
  })

  it('renders typed conversions, formatting, and diagnostics', () => {
    expect(odbOracle.ceil(odbLiteral(1.5)).toSQL()).toBe('CEIL(1.5)')
    expect(odbOracle.toClob('text').type).toBe('CLOB')
    expect(odbOracle.toBlob('raw').type).toBe('BLOB')
    expect(odbOracle.emptyClob().toSQL()).toBe('EMPTY_CLOB()')
    expect(odbOracle.emptyBlob().toSQL()).toBe('EMPTY_BLOB()')
    expect(odbOracle.nlsCharsetId(odbLiteral('AL32UTF8')).toSQL()).toBe(
      "NLS_CHARSET_ID('AL32UTF8')",
    )
    expect(odbOracle.count().toSQL()).toBe('COUNT(*)')
    expect(
      odbOracle
        .toChar(
          odbOracle.atTimeZone(odbOracle.sysTimestamp(), odbLiteral('UTC')),
          odbLiteral('Dy'),
          odbLiteral('NLS_DATE_LANGUAGE=English'),
        )
        .toSQL(),
    ).toBe("TO_CHAR((SYSTIMESTAMP AT TIME ZONE 'UTC'), 'Dy', 'NLS_DATE_LANGUAGE=English')")
    expect(odbOracle.sqlerrm().toSQL()).toBe('SQLERRM')
    expect(odbDbmsUtility.formatErrorBacktrace().toSQL()).toBe(
      'DBMS_UTILITY.FORMAT_ERROR_BACKTRACE',
    )
    expect(odbDbmsOutput.putLine(odbLiteral("a'b")).toSQL()).toBe("DBMS_OUTPUT.PUT_LINE('a''b')")
  })
})
