import { Command } from 'commander'
import { logger } from '../shared/logger.js'
import { fatalError } from '../shared/errors.js'
import { configDir } from '../shared/dirs.js'
import oracledb from 'oracledb'
import path from 'path'
import { existsSync, readFileSync } from 'fs'
import { execSync } from 'child_process'
import { EnvironmentStore } from '../adapters/environment-store.js'

// Thin mode - no Oracle client install required
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

function loadEnvFile(environment: string): Record<string, string> {
  const envPath = path.join(configDir, environment, '.env')

  if (!existsSync(envPath)) {
    throw new Error(`Config file not found: ${envPath}`)
  }

  const env: Record<string, string> = {}
  const content = readFileSync(envPath, 'utf-8')

  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^['"]|['"]$/g, '')
      env[key] = value
    }
  })

  return env
}

async function enableDbmsOutput(connection: oracledb.Connection): Promise<void> {
  await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`)
}

async function drainDbmsOutput(connection: oracledb.Connection): Promise<string[]> {
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

function getWalletPath(environment: string, projectName: string): string {
  const walletsDir = path.join(configDir, environment, '.wallets')
  const walletZipPath = path.join(walletsDir, `${projectName}-adb.zip`)

  if (!existsSync(walletZipPath)) {
    throw new Error(
      `Wallet zip not found at ${walletZipPath}. Please download the wallet first using 'ov infra-up'`,
    )
  }

  // Check if already extracted next to the zip
  const extractedDir = walletZipPath.replace('.zip', '')
  const tnsPath = path.join(extractedDir, 'tnsnames.ora')

  if (existsSync(tnsPath)) {
    logger.info(`Using extracted wallet from ${extractedDir}`)
    return extractedDir
  }

  // Extract the zip file
  logger.info('Extracting wallet...')
  try {
    execSync(
      `powershell -Command "Expand-Archive -Path '${walletZipPath}' -DestinationPath '${extractedDir}' -Force"`,
      {
        stdio: 'pipe',
      },
    )
  } catch (error) {
    fatalError(`Failed to extract wallet zip: ${(error as Error).message}`)
  }

  if (!existsSync(tnsPath)) {
    fatalError(`Wallet extraction failed: tnsnames.ora not found in ${extractedDir}`)
  }

  logger.info(`Wallet extracted to ${extractedDir}`)
  return extractedDir
}

export const registerDbExecCommand = (program: Command) => {
  program
    .command('db-exec <statement>')
    .alias('de')
    .description('Execute a SQL statement in the database')
    .action(async (statement: string) => {
      logger.info('Executing SQL statement...')

      const environmentStore = new EnvironmentStore()
      const { currentEnv, projectName } = environmentStore.getCurrent()

      try {
        // Load environment variables
        const env = loadEnvFile(currentEnv)

        const user = 'admin' // Default user for ATP
        const password = env.ODBVUE_ADMIN_PASSWORD
        const walletPassword = env.ODBVUE_WALLET_PASSWORD?.trim()
        const connectString = 'myatp_low' // Default connection alias

        if (!password) {
          fatalError(
            `Missing DB credentials in config/${currentEnv}/.env.  Set ODBVUE_ADMIN_PASSWORD`,
          )
        }

        // Resolve wallet path - extract from zip if needed
        const walletPath = getWalletPath(currentEnv, projectName)

        logger.info(`Connecting to ${connectString} as ${user}...`)

        // Connect to database
        const connectionConfig: Record<string, unknown> = {
          user,
          password,
          connectString,
          configDir: walletPath,
          walletLocation: walletPath,
        }

        if (walletPassword) {
          connectionConfig.walletPassword = walletPassword
        }

        let connection: oracledb.Connection
        try {
          connection = await oracledb.getConnection(connectionConfig)
        } catch (primaryError) {
          // Fallback: try without explicit wallet config
          try {
            connection = await oracledb.getConnection({ user, password, connectString })
          } catch {
            throw primaryError
          }
        }

        logger.info('Connected to database')

        // Enable DBMS_OUTPUT
        try {
          await enableDbmsOutput(connection)
        } catch {
          logger.warn('Could not enable DBMS_OUTPUT; continuing without it')
        }

        // Execute the statement
        const result = await connection.execute(statement)

        // Capture and display DBMS_OUTPUT
        try {
          const outputLines = await drainDbmsOutput(connection)
          if (outputLines.length > 0) {
            logger.info('DBMS_OUTPUT:')
            outputLines.forEach((line) => console.log(line))
          }
        } catch {
          // Ignore DBMS_OUTPUT retrieval failures
        }

        // Display query results
        logger.info('Query result:')
        if (result.rows && result.rows.length > 0) {
          console.table(result.rows)
        } else if (
          !statement.toUpperCase().includes('BEGIN') &&
          !statement.toUpperCase().includes('DECLARE')
        ) {
          // Only show "no rows" for SELECT statements, not for PL/SQL blocks
          logger.info('(No rows returned)')
        }

        await connection.close()
      } catch (error) {
        fatalError(error)
      }
    })
}
