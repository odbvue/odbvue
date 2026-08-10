import path from 'path'
import fs from 'fs'

import {
  connect,
  createExecutor,
  enableDbmsOutput,
  readDbmsOutput,
  resolveTnsAlias,
  splitSqlStatements,
  type OracleConnectionConfig,
} from '@odbvue/odb-oracledb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { EnvironmentStore } from '../adapters/environment-store.js'

import { logger } from '../shared/logger.js'

export type DbExecResponse = {
  dbms_output?: string[]
  rows?: unknown[]
  durationMs?: number
}

/** Resolve wallet/TNS/secret configuration for the current environment. */
export const buildConnectionConfig = (silent: boolean): OracleConnectionConfig => {
  const { envDir, projectName } = new EnvironmentStore().getCurrent()

  const walletPath = path.join(envDir, '.wallets', `${projectName}-adb.zip`)
  if (!fs.existsSync(walletPath)) {
    logger.fatal(`Wallet zip not found at ${walletPath}`)
  }
  if (!silent) logger.info(`Using wallet at ${walletPath}`)

  const tnsPath = path.join(envDir, '.wallets', `${projectName}-adb`, 'tnsnames.ora')
  const connectString = resolveTnsAlias(tnsPath)
  if (!silent) logger.info(`Using connection string ${connectString} from ${tnsPath}`)

  const secrets = new SecretsStore()
  const password = secrets.get('ODBVUE_ADB_ADMIN_PASSWORD')
  const walletPassword = secrets.get('ODBVUE_ADB_WALLET_PASSWORD')
  const envFilePath = path.join(envDir, '.env')
  if (!silent) logger.info(`Using ADMIN password from ${envFilePath}`)

  const walletDir = path.dirname(tnsPath)
  const config: OracleConnectionConfig = {
    user: 'ADMIN',
    password,
    connectString,
    configDir: walletDir,
    walletLocation: walletDir,
  }
  if (walletPassword) {
    config.walletPassword = walletPassword
  }
  return config
}

const runDbExecStatement = async (
  statements: string | string[],
  silent: boolean = true,
  fastFail: boolean = true,
) => {
  const totalStartTime = Date.now()
  const responses: DbExecResponse[] = []
  const list = Array.isArray(statements) ? statements : [statements]

  if (!silent) {
    logger.info(list.length === 1 ? `Executing SQL statement...` : `Executing SQL statements...`)
  }

  const config = buildConnectionConfig(silent)

  let connection: Awaited<ReturnType<typeof connect>> | undefined
  try {
    connection = await connect(config)
    if (!silent) logger.info('Connected to database')
    const executor = createExecutor(connection)

    try {
      await enableDbmsOutput(connection)
    } catch {
      logger.warn('Could not enable DBMS_OUTPUT')
    }

    for (const statement of list) {
      const response: DbExecResponse = {}
      const startTime = Date.now()
      if (!silent) {
        logger.muted(`  ${statement.substring(0, 77)}${statement.length > 77 ? '...' : ''}`)
      }

      try {
        const result = await executor.run(statement)

        try {
          const output = await readDbmsOutput(connection)
          if (output.length > 0) {
            response.dbms_output = output
            if (!silent) {
              logger.info('DBMS OUTPUT:')
              output.forEach((line) => logger.msg(line))
            }
          }
        } catch {
          logger.warn('Could not retrieve DBMS_OUTPUT')
        }

        if (!silent) logger.info('Query result:')
        if (result.rows && result.rows.length > 0) {
          response.rows = result.rows
          if (!silent) console.table(result.rows)
        } else if (!silent) {
          logger.muted('No rows returned')
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
