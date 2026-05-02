import path from 'path'
import fs from 'fs'
import oracledb from 'oracledb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { EnvironmentStore } from '../adapters/environment-store.js'

import { logger } from '../shared/logger.js'
import { fatalError } from '../shared/errors.js'

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

interface DbExecResponse {
  dbms_output?: string[]
  rows?: unknown[]
  durationMs?: number
}

export const runDbExec = async (statement: string, silent: boolean = true) => {
  let response: DbExecResponse = {}
  const startTime = Date.now()

  if (!silent) logger.info(`Executing SQL statement...`)
  if (!silent) logger.muted(`  ${statement.substring(0, 2000)}`)

  const { envDir, projectName } = new EnvironmentStore().getCurrent()
  const walletPath = path.join(envDir, '.wallets', `${projectName}-adb.zip`)
  if (!fs.existsSync(walletPath)) {
    fatalError(`Wallet zip not found at ${walletPath}`)
  }
  if (!silent) logger.info(`Using wallet at ${walletPath}`)

  const tnsPath = path.join(envDir, '.wallets', `${projectName}-adb`, 'tnsnames.ora')
  const connectString = connectionString(tnsPath)
  if (!silent) logger.info(`Using connection string ${connectString} from ${tnsPath}`)

  const secrets = new SecretsStore()
  const password = secrets.get('ODBVUE_ADMIN_PASSWORD')
  const walletPassword = secrets.get('ODBVUE_WALLET_PASSWORD')
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

    const result = await connection.execute(statement)

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
  } catch (error) {
    fatalError(`Failed to connect to database: ${error}`)
  } finally {
    if (connection) {
      await connection.close()
    }
  }

  response.durationMs = Date.now() - startTime
  if (!silent) logger.info(`Execution completed in ${response.durationMs} ms`)
  if (!silent) logger.lf()
  return response
}
