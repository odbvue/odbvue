import { describe, expect, it } from 'vitest'
import { odbAudit } from '../../../src/packages/framework/audit/audit.js'
import { ProcedureBody } from '../../../src/schema/package.js'

describe('odbAudit (framework package odb_audit)', () => {
  describe('install / drop SQL', () => {
    it('toSQLUp() emits the table, spec and body under the odb_audit name', () => {
      const sql = odbAudit.toSQLUp()
      expect(sql).toContain('CREATE TABLE odb_audit_logs (')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE odb_audit AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY odb_audit AS')
      expect(sql).not.toContain('pck_api_audit')
      expect(sql).not.toContain('app_audit')
    })

    it('toSQLUp() models an OTel LogRecord (severity + attributes)', () => {
      const sql = odbAudit.toSQLUp()
      expect(sql).toContain('severity_number')
      expect(sql).toContain('severity_text')
      expect(sql).toContain('observed_timestamp')
      expect(sql).toContain('event_timestamp')
      expect(sql).toContain('attributes IS JSON')
      expect(sql).toContain("severity_text IN ('TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')")
    })

    it('toSQLUp() guards the table DDL so re-installs are idempotent', () => {
      const sql = odbAudit.toSQLUp()
      expect(sql).toContain('EXECUTE IMMEDIATE')
      expect(sql).toContain('SQLCODE != -955')
    })

    it('toSQLUp({ schema }) qualifies the table and package names', () => {
      const sql = odbAudit.toSQLUp({ schema: 'APP_USER' })
      expect(sql).toContain('CREATE TABLE APP_USER.odb_audit_logs (')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE APP_USER.odb_audit AS')
      expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY APP_USER.odb_audit AS')
    })

    it('toSQLDown() drops the package and table', () => {
      const sql = odbAudit.toSQLDown()
      expect(sql).toContain('DROP PACKAGE odb_audit')
      expect(sql).toContain('DROP TABLE odb_audit_logs')
    })

    it('toSQLDown({ schema }) drops the qualified objects', () => {
      const sql = odbAudit.toSQLDown({ schema: 'APP_USER' })
      expect(sql).toContain('DROP PACKAGE APP_USER.odb_audit')
      expect(sql).toContain('DROP TABLE APP_USER.odb_audit_logs')
    })
  })

  describe('call-expression helpers', () => {
    it('renders severity helpers', () => {
      expect(odbAudit.debug("'msg'")).toBe("odb_audit.debug('msg')")
      expect(odbAudit.info("'msg'", 'v_attr')).toBe("odb_audit.info('msg', v_attr)")
      expect(odbAudit.warn("'msg'")).toBe("odb_audit.warn('msg')")
      expect(odbAudit.error("'msg'", 'v_attr')).toBe("odb_audit.error('msg', v_attr)")
      expect(odbAudit.fatal("'msg'")).toBe("odb_audit.fatal('msg')")
    })

    it('renders log() with optional arguments', () => {
      expect(odbAudit.log("'INFO'", "'msg'")).toBe("odb_audit.log('INFO', 'msg')")
      expect(odbAudit.log("'INFO'", "'msg'", 'v_attr')).toBe("odb_audit.log('INFO', 'msg', v_attr)")
      expect(odbAudit.log("'INFO'", "'msg'", undefined, 'systimestamp')).toBe(
        "odb_audit.log('INFO', 'msg', NULL, systimestamp)",
      )
    })

    it('renders utility helpers', () => {
      expect(odbAudit.severityNumber("'WARN'")).toBe("odb_audit.severity_number('WARN')")
      expect(odbAudit.bulk('v_data')).toBe('odb_audit.bulk(v_data)')
      expect(odbAudit.purge('v_cutoff')).toBe('odb_audit.purge(v_cutoff)')
    })
  })

  describe('ProcedureBody audit helpers', () => {
    const statements = (build: (body: ProcedureBody) => void): string[] => {
      const body = new ProcedureBody()
      build(body)
      return body.toNode().statements.map((s) => ('sql' in s ? s.sql : ''))
    }

    it('quotes the message and omits attributes when not provided', () => {
      expect(statements((b) => b.auditInfo('started'))).toEqual(["odb_audit.info('started')"])
      expect(statements((b) => b.auditWarn("O'Brien logged in"))).toEqual([
        "odb_audit.warn('O''Brien logged in')",
      ])
    })

    it('builds a JSON_OBJECT from the attributes map', () => {
      expect(statements((b) => b.auditEvent('user logged in', { 'user.id': 'p_uuid' }))).toEqual([
        "odb_audit.info('user logged in', JSON_OBJECT('user.id' VALUE p_uuid RETURNING CLOB))",
      ])
      expect(
        statements((b) =>
          b.auditError('failed', { 'user.id': 'p_uuid', 'http.request.method': 'v_method' }),
        ),
      ).toEqual([
        "odb_audit.error('failed', JSON_OBJECT('user.id' VALUE p_uuid, 'http.request.method' VALUE v_method RETURNING CLOB))",
      ])
    })

    it('maps each helper to its severity procedure', () => {
      expect(statements((b) => b.auditDebug('m'))).toEqual(["odb_audit.debug('m')"])
      expect(statements((b) => b.auditFatal('m'))).toEqual(["odb_audit.fatal('m')"])
    })
  })
})
