import path from 'path'
import fs from 'fs'
import oracledb from 'oracledb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { EnvironmentStore } from '../adapters/environment-store.js'

import { logger } from '../shared/logger.js'

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

const connectionString = (tnsPath: string, preferredEndsWith: string[] = ['_medium']): string => {
  const tnsContent = fs.readFileSync(tnsPath, 'utf-8')
  const aliases: string[] = []

  const aliasMatches = tnsContent.matchAll(/^\s*(\w+)\s*=/gm)
  for (const match of aliasMatches) {
    aliases.push(match[1])
  }

  const alias =
    aliases.find((a) => preferredEndsWith.some((suffix) => a.endsWith(suffix))) || aliases[0]
  return alias
}

const dbmsOutput = async (connection: oracledb.Connection): Promise<string[]> => {
  const lines: string[] = []

  while (true) {
    const result = await connection.execute(`BEGIN DBMS_OUTPUT.GET_LINE(:line, :status); END;`, {
      line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
      status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    })

    const outBinds = result.outBinds as { line?: string | null; status?: number }
    const status = outBinds.status ?? 1
    if (status !== 0) break

    const line = outBinds.line ?? ''
    lines.push(line)
  }

  return lines
}

export type DbExecResponse = {
  dbms_output?: string[]
  rows?: unknown[]
  durationMs?: number
}

const runDbExecStatement = async (
  statements: string | string[],
  silent: boolean = true,
  fastFail: boolean = true,
) => {
  const totalStartTime = Date.now()
  let response: DbExecResponse = {}
  let responses: DbExecResponse[] = []
  const statementCount = Array.isArray(statements) ? statements.length : 1

  if (!silent)
    logger.info(statementCount == 1 ? `Executing SQL statement...` : `Executing SQL statements...`)

  const { envDir, projectName } = new EnvironmentStore().getCurrent()
  const walletPath = path.join(envDir, '.wallets', `${projectName}-adb.zip`)
  if (!fs.existsSync(walletPath)) {
    logger.fatal(`Wallet zip not found at ${walletPath}`)
  }
  if (!silent) logger.info(`Using wallet at ${walletPath}`)

  const tnsPath = path.join(envDir, '.wallets', `${projectName}-adb`, 'tnsnames.ora')
  const connectString = connectionString(tnsPath)
  if (!silent) logger.info(`Using connection string ${connectString} from ${tnsPath}`)

  const secrets = new SecretsStore()
  const password = secrets.get('ODBVUE_ADB_ADMIN_PASSWORD')
  const walletPassword = secrets.get('ODBVUE_ADB_WALLET_PASSWORD')
  const envFilePath = path.join(envDir, '.env')
  if (!silent) logger.info(`Using ADMIN password from ${envFilePath}`)

  const walletDir = path.dirname(tnsPath)
  const connectionConfig: Record<string, unknown> = {
    user: 'ADMIN',
    password,
    connectString,
    configDir: walletDir,
    walletLocation: walletDir,
  }
  if (walletPassword) {
    connectionConfig.walletPassword = walletPassword
  }

  let connection: oracledb.Connection | undefined
  try {
    connection = await oracledb.getConnection(connectionConfig)
    if (!silent) logger.info('Connected to database')

    try {
      await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`)
    } catch {
      logger.warn('Could not enable DBMS_OUTPUT')
    }

    for (const statement of Array.isArray(statements) ? statements : [statements]) {
      response = {}
      const startTime = Date.now()
      if (!silent)
        logger.muted(`  ${statement.substring(0, 77)}${statement.length > 77 ? '...' : ''}`)

      try {
        const sql = statement.trim()
        // node-oracledb rule: PL/SQL statements (anonymous blocks and PL/SQL DDL)
        // REQUIRE the trailing ';'. Plain SQL DDL/DML must NOT have one.
        const isPLSQL =
          /^(BEGIN|DECLARE|CREATE\s+(OR\s+REPLACE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b)/i.test(
            sql,
          )
        const execSql = isPLSQL ? sql : sql.replace(/;$/, '')
        const result = await connection.execute(execSql)
        try {
          const output = await dbmsOutput(connection)
          if (output.length > 0) {
            response.dbms_output = output
            if (!silent) logger.info('DBMS OUTPUT:')
            if (!silent)
              output.forEach((line) => {
                if (!silent) logger.msg(line)
              })
          }
        } catch {
          logger.warn('Could not retrieve DBMS_OUTPUT')
        }

        if (!silent) logger.info('Query result:')
        if (result.rows && result.rows.length > 0) {
          response.rows = result.rows
          if (!silent) console.table(result.rows)
        } else {
          if (!silent) logger.muted('No rows returned')
        }
        await connection.commit()
      } catch (error) {
        if (fastFail) {
          logger.fatal(`Failed to execute statement: ${error}`)
        } else {
          logger.error(`Failed to execute statement: ${error}`)
        }
        await connection.rollback()
      }
      response.durationMs = Date.now() - startTime
      responses.push(response)
    }
  } catch (error) {
    logger.fatal(`Failed to connect to database: ${error}`)
  } finally {
    if (connection) {
      await connection.close()
    }
  }
  if (!silent) logger.info(`Execution completed in ${Date.now() - totalStartTime} ms`)
  if (!silent) logger.lf()
  return responses
}

/**
 * Quote-aware splitter for plain DDL/DML statements delimited by `;`.
 * Does not handle PL/SQL blocks — use splitSqlStatements for mixed input.
 */
const splitBySemicolon = (sql: string): string[] => {
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

        if (char === '\n') {
          inLineComment = false
        }

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

      if (trimmed) {
        statements.push(trimmed)
      }

      current = ''
      continue
    }

    current += char
  }

  const trimmed = current.trim()

  if (trimmed) {
    statements.push(trimmed)
  }

  return statements
}

/**
 * Split a SQL script into individual statements ready for execution.
 *
 * Strategy:
 *  1. Split on `/` that appears alone on a line (SQL*Plus PL/SQL block terminator).
 *     Each such segment is a single PL/SQL block (CREATE OR REPLACE PACKAGE/PROCEDURE/
 *     FUNCTION, anonymous BEGIN...END) and must be executed atomically.
 *  2. Any segment that does NOT start with a PL/SQL keyword is treated as plain DDL/DML
 *     and is further split by `;` using the quote-aware splitter.
 */
const splitSqlStatements = (sql: string): string[] => {
  const results: string[] = []

  // '/' on its own line (optionally with trailing whitespace) is the block terminator
  const segments = sql.split(/^\/\s*$/m)

  const plsqlBlockRegex =
    /^\s*(CREATE\s+(OR\s+REPLACE\s+)?(PACKAGE|PROCEDURE|FUNCTION|TRIGGER|TYPE)\b|BEGIN\b)/i

  for (const segment of segments) {
    const trimmed = segment.trim()
    if (!trimmed) continue

    if (plsqlBlockRegex.test(trimmed)) {
      // PL/SQL block: emit as one statement (the execute loop strips the trailing ';')
      results.push(trimmed)
    } else {
      // Plain DDL/DML: split by ';' as before
      results.push(...splitBySemicolon(trimmed))
    }
  }

  return results
}

export const runDbExec = async (
  statement: string,
  silent: boolean = true,
  fastFail: boolean = true,
) => {
  if (fs.existsSync(statement)) {
    const fileContent = fs.readFileSync(statement, 'utf-8')
    logger.muted(`  ${statement}`)
    const statements = splitSqlStatements(fileContent)
    return await runDbExecStatement(statements, silent, fastFail)
  }

  return await runDbExecStatement(statement, silent, fastFail)
}
