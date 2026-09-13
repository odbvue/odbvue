import { describe, expect, it } from 'vitest'
import { odbRateLimit } from '../../../src/packages/framework/rate-limit/rate-limit.js'

describe('odbRateLimit framework package', () => {
  it('emits bucket storage and autonomous package procedures', () => {
    const sql = odbRateLimit.toSQLUp({ schema: 'APP' })

    expect(sql).toContain('CREATE TABLE APP.odb_rate_limit_buckets')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_rate_limit AS')
    expect(sql).toContain('FUNCTION hash_subject(p_subject IN VARCHAR2) RETURN VARCHAR2;')
    expect(sql).toContain('PROCEDURE failure(p_scope IN VARCHAR2, p_subject IN VARCHAR2);')
    expect(sql).toContain('PRAGMA AUTONOMOUS_TRANSACTION;')
    expect(sql).toContain(
      'SELECT window_started_at, failure_count INTO l_window_started_at, l_failure_count',
    )
    expect(sql).toContain('FOR UPDATE;')
    expect(sql).toContain('INSERT INTO odb_rate_limit_buckets')
    expect(sql).toContain('DELETE FROM odb_rate_limit_buckets')
  })

  it('uses local function calls when built under a blue-green physical name', () => {
    const sql = odbRateLimit.toSQLUp({ schema: 'APP', physicalName: 'odb_rate_limit_blue' })

    expect(sql).toContain('CREATE OR REPLACE PACKAGE BODY APP.odb_rate_limit_blue AS')
    expect(sql).toContain('l_subject_hash := hash_subject(p_subject);')
    expect(sql).not.toContain('odb_rate_limit.hash_subject')
  })
})
