import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'
import os from 'os'
import dotenv from 'dotenv'
import unzipper from 'unzipper'
import { rootDir, logger } from './index.js'

// Thin mode is default — no client install required
// Don't initialize the Oracle Client library (use Thin mode)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

async function enableDbmsOutput(connection: oracledb.Connection): Promise<void> {
  // Use a large buffer; NULL means unlimited in some versions but not all.
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
    if (status !== 0) {
      break
    }

    const line = outBinds.line ?? ''
    lines.push(line)
  }

  return lines
}

/**
 * Load environment variables from project/environment config directory
 */
function loadEnv(project: string, environment: string): Record<string, string> {
  const envPath = path.join(rootDir, 'config', project, environment, '.env')

  if (!fs.existsSync(envPath)) {
    throw new Error(`Config file not found: ${envPath}`)
  }

  const result = dotenv.config({ path: envPath })
  if (result.error) {
    throw new Error(`Failed to load config: ${result.error.message}`)
  }

  return result.parsed || {}
}

function buildBinds(sql: string, env: Record<string, string>): oracledb.BindParameters {
  const bindNames = new Set<string>()
  const regex = /:(\w+)/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(sql)) !== null) {
    bindNames.add(match[1])
  }

  if (bindNames.size === 0) {
    return {} as oracledb.BindParameters
  }

  const binds: Record<string, unknown> = {}

  for (const name of bindNames) {
    const upper = name.toUpperCase()

    // Most explicit mapping
    const explicit = env[`DB_BIND_${upper}`]
    if (explicit !== undefined) {
      binds[name] = explicit
      continue
    }

    // Conventional mappings
    if (name.toLowerCase() === 'username') {
      binds[name] =
        env.DB_SCHEMA_USERNAME || env.DB_APP_USERNAME || env.DB_ADMIN_USERNAME || env[`DB_${upper}`]
      continue
    }

    if (name.toLowerCase() === 'password') {
      binds[name] =
        env.DB_SCHEMA_PASSWORD || env.DB_APP_PASSWORD || env.DB_ADMIN_PASSWORD || env[`DB_${upper}`]
      continue
    }

    // Generic fallback
    binds[name] = env[`DB_${upper}`] ?? env[upper] ?? env[name]
  }

  const missing = Object.entries(binds)
    .filter(([, v]) => v === undefined || v === null || `${v}`.length === 0)
    .map(([k]) => k)

  if (missing.length > 0) {
    throw new Error(
      `Missing bind values for: ${missing.join(', ')}. ` +
        `Set DB_BIND_${missing.map((m) => m.toUpperCase()).join(', DB_BIND_')} in your .env`,
    )
  }

  return binds as oracledb.BindParameters
}

/**
 * Ensure wallet is available - prefer pre-extracted, extract from zip if needed
 */
async function ensureWalletExtracted(walletPath: string): Promise<string> {
  // Check if wallet is already unzipped in the expected location
  const tnsPath = path.join(walletPath, 'tnsnames.ora')
  if (fs.existsSync(tnsPath)) {
    logger.muted('Using pre-extracted wallet from config')
    return walletPath
  }

  // Check for extracted subfolder
  const extractedPath = path.join(walletPath, 'extracted')
  const extractedTnsPath = path.join(extractedPath, 'tnsnames.ora')
  if (fs.existsSync(extractedTnsPath)) {
    logger.muted('Using pre-extracted wallet from extracted/ subfolder')
    return extractedPath
  }

  // Look for zip file to extract
  const zipPath = path.join(walletPath, 'odbvue-db-dev.zip')
  if (!fs.existsSync(zipPath)) {
    throw new Error(
      `Wallet not found in ${walletPath}\n` +
        `Expected one of:\n` +
        `  1. Pre-extracted wallet files (tnsnames.ora, ewallet.p12, etc.)\n` +
        `  2. extracted/ subfolder with wallet files\n` +
        `  3. odbvue-db-dev.zip to be auto-extracted`,
    )
  }

  logger.info('Extracting wallet from zip...')

  // Extract to temp directory
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-'))

  return new Promise((resolve, reject) => {
    fs.createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: tempDir }))
      .on('close', () => {
        const extractedTns = path.join(tempDir, 'tnsnames.ora')
        if (!fs.existsSync(extractedTns)) {
          reject(new Error(`Wallet extraction failed: tnsnames.ora not found`))
          return
        }
        logger.muted(`Wallet extracted to ${tempDir}`)
        resolve(tempDir)
      })
      .on('error', (err) => {
        logger.error(`Failed to extract wallet: ${err.message}`)
        reject(err)
      })
  })
}

/**
 * Execute a SQL file against Oracle Database
 * - Loads credentials from config/{project}/{environment}/.env
 * - Uses wallet from config/{project}/{environment}/.wallets/
 * - Automatically unzips wallet if needed
 * - Defaults to 'myatp_high' service name if DB_CONNECT_STRING not set
 */
export async function runSqlFile(
  project: string,
  environment: string,
  sqlFilePath: string,
): Promise<void> {
  // Resolve absolute path to SQL file
  const absoluteSqlPath = path.isAbsolute(sqlFilePath)
    ? sqlFilePath
    : path.join(rootDir, sqlFilePath)

  if (!fs.existsSync(absoluteSqlPath)) {
    throw new Error(`SQL file not found: ${absoluteSqlPath}`)
  }

  // Load environment config
  const env = loadEnv(project, environment)

  const walletBasePath = path.join(rootDir, 'config', project, environment, '.wallets')
  const user = env.DB_ADMIN_USERNAME
  const password = env.DB_ADMIN_PASSWORD
  // Default to 'myatp_high' if not specified
  const connectString = env.DB_CONNECT_STRING || 'myatp_high'

  if (!user || !password) {
    throw new Error(
      `Missing DB credentials in ${project}/${environment} config. ` +
        'Set DB_ADMIN_USERNAME and DB_ADMIN_PASSWORD in .env',
    )
  }

  logger.info(`Connecting to ${connectString} as ${user}...`)

  // Extract wallet if needed
  let walletPath: string
  try {
    walletPath = await ensureWalletExtracted(walletBasePath)
    logger.info(`Wallet: ${walletPath}`)
  } catch (error) {
    if (error instanceof Error) {
      logger.error(error.message)
    }
    throw error
  }

  let connection: oracledb.Connection | undefined
  try {
    logger.info(`Using wallet from: ${walletPath}`)

    const originalTNS_ADMIN = process.env.TNS_ADMIN
    process.env.TNS_ADMIN = walletPath

    const walletPassword = env.DB_WALLET_PASSWORD?.trim()

    // Strategy 1 (preferred): Explicit wallet config (loads wallet trust store)
    try {
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

      connection = await oracledb.getConnection(connectionConfig)
    } catch (primaryError) {
      // Strategy 2 (fallback): Use TNS_ADMIN + sqlnet.ora/tnsnames.ora only
      try {
        const fallbackConfig: Record<string, unknown> = {
          user,
          password,
          connectString,
        }

        connection = await oracledb.getConnection(fallbackConfig)
      } catch (fallbackError) {
        // Preserve the more actionable error if possible
        throw primaryError instanceof Error ? primaryError : fallbackError
      }
    } finally {
      // Restore original TNS_ADMIN
      if (originalTNS_ADMIN === undefined) {
        delete process.env.TNS_ADMIN
      } else {
        process.env.TNS_ADMIN = originalTNS_ADMIN
      }
    }

    logger.success('Connected to database')

    try {
      await enableDbmsOutput(connection)
      logger.muted('DBMS_OUTPUT enabled')
    } catch {
      // Not fatal; some environments/users may not have DBMS_OUTPUT.
      logger.warn('Could not enable DBMS_OUTPUT; continuing without it')
    }

    // Read SQL file
    const sqlContent = fs.readFileSync(absoluteSqlPath, 'utf8')

    // Split on / (Oracle statement delimiter), not ; (which breaks PL/SQL)
    const statements = sqlContent
      .split(/\n\/\s*$/m) // Split on newline followed by / at end of line
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    if (statements.length === 0) {
      logger.warn('No SQL statements found in file')
      return
    }

    logger.info(`Executing ${statements.length} statement(s)...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      logger.muted(`  [${i + 1}/${statements.length}] Executing statement...`)

      try {
        const binds = buildBinds(stmt, env)
        await connection.execute(stmt, binds, { autoCommit: true })

        // Print DBMS_OUTPUT emitted by this statement (if any)
        try {
          const outputLines = await drainDbmsOutput(connection)
          for (const line of outputLines) {
            logger.log(line)
          }
        } catch {
          // Ignore DBMS_OUTPUT failures during execution
        }
      } catch (err) {
        logger.error(`Failed to execute statement ${i + 1}:`)
        logger.error(stmt.substring(0, 200) + (stmt.length > 200 ? '...' : ''))
        throw err
      }
    }

    logger.success(`Successfully executed ${statements.length} statement(s)`)
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Database error: ${error.message}`)

      // Provide helpful hints for common errors
      if (error.message.includes('unable to initiate TLS')) {
        logger.log('')
        logger.info('TLS connection failed. Verify:')
        logger.info('  1. Database is running on localhost:1522')
        logger.info('  2. Wallet password is correct')
        logger.info('  3. Run: pnpm -w exec docker-compose -f i13e/db/local/compose.yaml up -d')
      } else if (error.message.includes('NJS-521')) {
        logger.log('')
        logger.info('Connection string not found in tnsnames.ora')
        logger.info(`  Available: myatp_high, myatp_medium, myatp_low`)
      } else if (
        error.message.includes('TLS handshake failure') ||
        error.message.toLowerCase().includes('self-signed certificate')
      ) {
        logger.log('')
        logger.info('TLS handshake failed due to certificate trust.')
        logger.info('This usually means the wallet trust store was not loaded or is mismatched.')
        logger.info(`Wallet dir used: ${walletPath}`)
        logger.info('Try:')
        logger.info('  1. Ensure wallet contains cwallet.sso + tnsnames.ora + sqlnet.ora')
        logger.info('  2. Re-download wallet via: ov db-setup-local')
        logger.info('  3. If using a custom wallet password, confirm DB_WALLET_PASSWORD matches')
      }
    } else {
      logger.error(`Unknown error: ${error}`)
    }
    throw error
  } finally {
    if (connection) {
      try {
        await connection.close()
        logger.muted('Connection closed')
      } catch (err) {
        logger.warn(`Warning: Failed to close connection: ${err}`)
      }
    }
  }
}
