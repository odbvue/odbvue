import type { CompiledQuery } from '../../query/ast.js'

export type Executable = string | CompiledQuery | { compile(): CompiledQuery }

export function normalizeExecutable(executable: Executable): CompiledQuery {
  if (typeof executable === 'string') return { sql: executable, bindings: {} }
  if ('compile' in executable) return executable.compile()
  return executable
}

export function isPlsql(sql: string): boolean {
  return /^\s*(BEGIN|DECLARE|CREATE\s+(OR\s+REPLACE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b)/i.test(
    sql,
  )
}

export function prepareStatement(sql: string): string {
  const trimmed = sql.trim()
  return isPlsql(trimmed) ? trimmed : trimmed.replace(/;$/, '')
}

export function splitBySemicolon(sql: string): string[] {
  const statements: string[] = []
  let current = ''
  let inSingleQuote = false
  let inDoubleQuote = false
  let inLineComment = false
  let inBlockComment = false

  for (let index = 0; index < sql.length; index++) {
    const char = sql[index]
    const next = sql[index + 1]
    if (!inSingleQuote && !inDoubleQuote && !inBlockComment) {
      if (!inLineComment && char === '-' && next === '-') inLineComment = true
      if (inLineComment) {
        current += char
        if (char === '\n') inLineComment = false
        continue
      }
    }
    if (!inSingleQuote && !inDoubleQuote && !inLineComment) {
      if (!inBlockComment && char === '/' && next === '*') inBlockComment = true
      if (inBlockComment) {
        current += char
        if (char === '*' && next === '/') {
          current += next
          index++
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
      continue
    }
    const embeddedPlsql = embeddedPlsqlBlockRegex.exec(trimmed)
    if (embeddedPlsql && embeddedPlsql.index > 0) {
      const plainSql = trimmed.slice(0, embeddedPlsql.index).trim()
      const plsql = trimmed.slice(embeddedPlsql.index).trim()
      results.push(...splitBySemicolon(plainSql), plsql)
    } else {
      results.push(...splitBySemicolon(trimmed))
    }
  }
  return results
}
