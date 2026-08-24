import { describe, expect, it } from 'vitest'

import {
  isPlsql,
  normalizeExecutable,
  prepareStatement,
  splitBySemicolon,
  splitSqlStatements,
} from '../src/oracle/execution/sql.js'

describe('Oracle SQL helpers', () => {
  it('detects PL/SQL and preserves its terminator', () => {
    expect(isPlsql('BEGIN NULL; END;')).toBe(true)
    expect(isPlsql('CREATE TABLE t (id NUMBER)')).toBe(false)
    expect(prepareStatement('SELECT 1 FROM dual;')).toBe('SELECT 1 FROM dual')
    expect(prepareStatement('BEGIN NULL; END;')).toBe('BEGIN NULL; END;')
  })

  it('normalizes strings, compiled queries, and builders', () => {
    expect(normalizeExecutable('SELECT 1 FROM dual')).toEqual({
      sql: 'SELECT 1 FROM dual',
      bindings: {},
    })
    const compiled = { sql: 'SELECT :a FROM dual', bindings: { a: 1 } }
    expect(normalizeExecutable(compiled)).toBe(compiled)
    expect(normalizeExecutable({ compile: () => compiled })).toBe(compiled)
  })

  it('splits SQL without splitting quoted semicolons or PL/SQL blocks', () => {
    expect(splitBySemicolon("INSERT INTO t VALUES ('a;b'); DELETE FROM t;")).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      'DELETE FROM t',
    ])
    const statements = splitSqlStatements('CREATE TABLE t (id NUMBER);\nBEGIN NULL; END;\n/')
    expect(statements).toEqual(['CREATE TABLE t (id NUMBER)', 'BEGIN NULL; END;'])
  })
})
