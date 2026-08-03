import type { CompiledQuery } from '@odbvue/odb'

/** Anything that can be executed: raw SQL, a compiled query, or a query builder. */
export type Executable = string | CompiledQuery | { compile(): CompiledQuery }

/** Normalize an executable into `{ sql, bindings }`. */
export function normalizeExecutable(executable: Executable): CompiledQuery {
  if (typeof executable === 'string') return { sql: executable, bindings: {} }
  if ('compile' in executable) return executable.compile()
  return executable
}

/**
 * True when the statement is a PL/SQL block (anonymous block or PL/SQL DDL).
 * node-oracledb requires PL/SQL to keep its trailing `;`, whereas plain SQL
 * DDL/DML must not have one.
 */
export function isPlsql(sql: string): boolean {
  return /^\s*(BEGIN|DECLARE|CREATE\s+(OR\s+REPLACE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b)/i.test(
    sql,
  )
}

/** Prepare a single statement for `connection.execute`: keep `;` for PL/SQL, strip for SQL. */
export function prepareStatement(sql: string): string {
  const trimmed = sql.trim()
  return isPlsql(trimmed) ? trimmed : trimmed.replace(/;$/, '')
}

/**
 * Quote-aware splitter for plain DDL/DML statements delimited by `;`.
 * Does not handle PL/SQL blocks — use {@link splitSqlStatements} for mixed input.
 */
export function splitBySemicolon(sql: string): string[] {
  const statements: string[] = []

  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const next = sql[i + 1]

    if (!inSingleQuote && !inDoubleQuote && !inBlockComment) {
      if (!inLineComment && char === '-' && next === '-') {
        inLineComment = true
      }

      if (inLineComment) {
        current += char
        if (char === '\n') inLineComment = false
        continue
      }
    }

    if (!inSingleQuote && !inDoubleQuote && !inLineComment) {
      if (!inBlockComment && char === '/' && next === '*') {
        inBlockComment = true
      }

      if (inBlockComment) {
        current += char
        if (char === '*' && next === '/') {
          current += next
          i++
          inBlockComment = false
        }
        continue
      }
    }

    if (!inDoubleQuote && char === "'") {
      inSingleQuote = !inSingleQuote
      current += char
      continue
    }

    if (!inSingleQuote && char === '"') {
      inDoubleQuote = !inDoubleQuote
      current += char
      continue
    }

    if (char === ';' && !inSingleQuote && !inDoubleQuote && !inLineComment && !inBlockComment) {
      const trimmed = current.trim()
      if (trimmed) statements.push(trimmed)
      current = ''
      continue
    }

    current += char
  }

  const trimmed = current.trim()
  if (trimmed) statements.push(trimmed)

  return statements
}

/**
 * Split a SQL script into individual statements ready for execution.
 *
 * Strategy:
 *  1. Split on `/` alone on a line (SQL*Plus PL/SQL block terminator). Each such
 *     segment is a single PL/SQL block and is executed atomically.
 *  2. A segment can start with plain SQL and then contain a PL/SQL block; the
 *     plain prefix is split while the PL/SQL block is preserved as one statement.
 *  3. Any remaining segment is plain DDL/DML, split by `;` via the quote-aware splitter.
 */
export function splitSqlStatements(sql: string): string[] {
  const results: string[] = []
  const segments = sql.split(/^\/\s*$/m)

  const plsqlBlockRegex =
    /^\s*(CREATE\s+(OR\s+REPLACE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b|BEGIN\b|DECLARE\b)/i
  const embeddedPlsqlBlockRegex =
    /(?:^|\n)\s*(?=CREATE\s+(OR\s+REPLACE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b|BEGIN\b|DECLARE\b)/i

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    if (plsqlBlockRegex.test(trimmed)) {
      results.push(trimmed)
    } else {
      const embeddedPlsql = embeddedPlsqlBlockRegex.exec(trimmed)
      if (embeddedPlsql && embeddedPlsql.index > 0) {
        const plainSql = trimmed.slice(0, embeddedPlsql.index).trim()
        const plsql = trimmed.slice(embeddedPlsql.index).trim()
        results.push(...splitBySemicolon(plainSql), plsql)
      } else {
        results.push(...splitBySemicolon(trimmed))
      }
    }
  }

  return results
}
