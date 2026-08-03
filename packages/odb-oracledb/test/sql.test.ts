import { describe, expect, it } from 'vitest'
import {
  isPlsql,
  normalizeExecutable,
  prepareStatement,
  splitBySemicolon,
  splitSqlStatements,
} from '../src/sql.js'

describe('isPlsql', () => {
  it('detects PL/SQL blocks and PL/SQL DDL', () => {
    expect(isPlsql('BEGIN NULL; END;')).toBe(true)
    expect(isPlsql('DECLARE x NUMBER; BEGIN NULL; END;')).toBe(true)
    expect(isPlsql('CREATE OR REPLACE PACKAGE pck AS END;')).toBe(true)
    expect(isPlsql('CREATE PROCEDURE p AS BEGIN NULL; END;')).toBe(true)
  })

  it('treats plain SQL as non-PL/SQL', () => {
    expect(isPlsql('SELECT 1 FROM dual')).toBe(false)
    expect(isPlsql('CREATE TABLE t (id NUMBER)')).toBe(false)
    expect(isPlsql('INSERT INTO t VALUES (1)')).toBe(false)
  })
})

describe('prepareStatement', () => {
  it('strips the trailing semicolon from plain SQL', () => {
    expect(prepareStatement('SELECT 1 FROM dual;')).toBe('SELECT 1 FROM dual')
  })

  it('keeps the trailing semicolon for PL/SQL', () => {
    expect(prepareStatement('BEGIN NULL; END;')).toBe('BEGIN NULL; END;')
  })
})

describe('normalizeExecutable', () => {
  it('wraps a raw string with empty bindings', () => {
    expect(normalizeExecutable('SELECT 1 FROM dual')).toEqual({
      sql: 'SELECT 1 FROM dual',
      bindings: {},
    })
  })

  it('passes through a compiled query', () => {
    const compiled = { sql: 'SELECT :a FROM dual', bindings: { a: 1 } }
    expect(normalizeExecutable(compiled)).toBe(compiled)
  })

  it('compiles a query builder', () => {
    const builder = { compile: () => ({ sql: 'SELECT 1 FROM dual', bindings: {} }) }
    expect(normalizeExecutable(builder)).toEqual({ sql: 'SELECT 1 FROM dual', bindings: {} })
  })
})

describe('splitBySemicolon', () => {
  it('splits on semicolons outside string literals and comments', () => {
    const sql = "INSERT INTO t VALUES ('a;b'); DELETE FROM t; -- x; y\nSELECT 1 FROM dual"
    expect(splitBySemicolon(sql)).toEqual([
      "INSERT INTO t VALUES ('a;b')",
      'DELETE FROM t',
      '-- x; y\nSELECT 1 FROM dual',
    ])
  })
})

describe('splitSqlStatements', () => {
  it('keeps PL/SQL blocks terminated by a lone slash intact', () => {
    const script = [
      'CREATE TABLE t (id NUMBER);',
      'CREATE OR REPLACE PACKAGE pck AS',
      '  PROCEDURE p;',
      'END;',
      '/',
    ].join('\n')

    const statements = splitSqlStatements(script)
    expect(statements).toHaveLength(2)
    expect(statements[0]).toBe('CREATE TABLE t (id NUMBER)')
    expect(statements[1]).toContain('CREATE OR REPLACE PACKAGE pck AS')
    expect(statements[1]).toContain('END;')
  })
})
