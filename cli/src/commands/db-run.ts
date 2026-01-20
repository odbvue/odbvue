import { Command } from 'commander'
import oracledb from 'oracledb'
import {
  logger,
  rootDir,
  path,
  existsSync,
  readFileSync,
  mkdirSync,
  expandZipToDirectory,
  getDefaultEnvironment,
  detectPreferredTnsAlias,
} from '../utils.js'
import { createWriteStream } from 'fs'
import os from 'os'

// Thin mode - no Oracle client install required
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

// ============================================================================
// Environment & Configuration
// ============================================================================

interface DbEnv {
  DB_ADMIN_USERNAME?: string
  DB_ADMIN_PASSWORD?: string
  DB_WALLET_PATH?: string
  DB_WALLET_PASSWORD?: string
  DB_CONNECT_STRING?: string
  [key: string]: string | undefined
}

/**
 * Load environment variables from config/<environment>/.env
 */
function loadEnv(environment: string): DbEnv {
  const envPath = path.join(rootDir, 'config', environment, '.env')

  if (!existsSync(envPath)) {
    throw new Error(`Config file not found: ${envPath}`)
  }

  const env: DbEnv = {}
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

/**
 * Get wallet directory path - resolves relative paths from config dir
 * If wallet is a zip file, extracts it to a temp directory
 */
function getWalletPath(env: DbEnv, environment: string): string {
  const walletPath = env.DB_WALLET_PATH
  if (!walletPath) {
    throw new Error('DB_WALLET_PATH not set in environment config')
  }

  const configDir = path.join(rootDir, 'config', environment)

  // Resolve the path
  let resolvedPath: string
  if (walletPath.startsWith('./') || walletPath.startsWith('../')) {
    resolvedPath = path.resolve(configDir, walletPath)
  } else {
    resolvedPath = walletPath
  }

  // If it's a zip file, extract to temp directory
  if (resolvedPath.endsWith('.zip')) {
    if (!existsSync(resolvedPath)) {
      throw new Error(`Wallet zip file not found: ${resolvedPath}`)
    }

    // Check if already extracted next to the zip
    const extractedDir = resolvedPath.replace('.zip', '')
    const tnsPath = path.join(extractedDir, 'tnsnames.ora')

    if (existsSync(tnsPath)) {
      logger.muted('Using pre-extracted wallet')
      return extractedDir
    }

    // Extract to temp directory
    logger.muted('Extracting wallet from zip...')
    const tempDir = path.join(os.tmpdir(), `wallet-${Date.now()}`)
    expandZipToDirectory(resolvedPath, tempDir)

    const tempTnsPath = path.join(tempDir, 'tnsnames.ora')
    if (!existsSync(tempTnsPath)) {
      throw new Error('Wallet extraction failed: tnsnames.ora not found')
    }

    return tempDir
  }

  // Check if it's a directory with tnsnames.ora
  const tnsPath = path.join(resolvedPath, 'tnsnames.ora')
  if (!existsSync(tnsPath)) {
    throw new Error(`Wallet directory invalid: tnsnames.ora not found in ${resolvedPath}`)
  }

  return resolvedPath
}

// ============================================================================
// DBMS_OUTPUT Support
// ============================================================================

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

// ============================================================================
// SQL Parsing
// ============================================================================

/**
 * Parse SQL file content into individual executable statements
 */
function parseSqlStatements(content: string): string[] {
  const statements: string[] = []
  const lines = content.split('\n')
  let currentStatement = ''
  let inPlsqlBlock = false

  for (const line of lines) {
    const trimmedLine = line.trim()

    // Skip empty lines and comments at the start of a new statement
    if (!currentStatement && (trimmedLine === '' || trimmedLine.startsWith('--'))) {
      continue
    }

    // Check if we're entering a PL/SQL block
    if (!inPlsqlBlock) {
      const upperLine = trimmedLine.toUpperCase()
      if (
        upperLine.startsWith('BEGIN') ||
        upperLine.startsWith('DECLARE') ||
        upperLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?(EDITIONABLE\s+)?PACKAGE/) ||
        upperLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?(EDITIONABLE\s+)?PROCEDURE/) ||
        upperLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?(EDITIONABLE\s+)?FUNCTION/) ||
        upperLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?(EDITIONABLE\s+)?TRIGGER/) ||
        upperLine.match(/^CREATE\s+(OR\s+REPLACE\s+)?(EDITIONABLE\s+)?TYPE/)
      ) {
        inPlsqlBlock = true
      }
    }

    // Check for / on its own line (PL/SQL block terminator)
    if (trimmedLine === '/') {
      if (currentStatement.trim()) {
        statements.push(currentStatement.trim())
        currentStatement = ''
      }
      inPlsqlBlock = false
      continue
    }

    // If in PL/SQL block, just accumulate lines
    if (inPlsqlBlock) {
      currentStatement += line + '\n'
      continue
    }

    // For regular SQL, check if line ends with ;
    if (trimmedLine.endsWith(';')) {
      currentStatement += line + '\n'
      const stmt = currentStatement.trim().replace(/;$/, '').trim()
      if (stmt) {
        statements.push(stmt)
      }
      currentStatement = ''
    } else {
      currentStatement += line + '\n'
    }
  }

  // Handle any remaining statement
  if (currentStatement.trim()) {
    const stmt = currentStatement.trim().replace(/;$/, '').trim()
    if (stmt) {
      statements.push(stmt)
    }
  }

  return statements
}

// ============================================================================
// Main Execution
// ============================================================================

async function runSqlFile(
  environment: string,
  inputFile: string,
  outputFile?: string,
): Promise<void> {
  // Resolve input file path
  const absoluteInputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.resolve(process.cwd(), inputFile)

  if (!existsSync(absoluteInputPath)) {
    throw new Error(`SQL file not found: ${absoluteInputPath}`)
  }

  // Load environment
  const env = loadEnv(environment)

  const user = env.DB_ADMIN_USERNAME
  const password = env.DB_ADMIN_PASSWORD
  const walletPath = getWalletPath(env, environment)
  const walletPassword = env.DB_WALLET_PASSWORD?.trim()

  // Auto-detect connect string from tnsnames.ora if not explicitly set
  let connectString = env.DB_CONNECT_STRING
  if (!connectString) {
    const tnsPath = path.join(walletPath, 'tnsnames.ora')
    if (existsSync(tnsPath)) {
      const tnsContent = readFileSync(tnsPath, 'utf-8')
      connectString = detectPreferredTnsAlias(tnsContent) || 'myatp_high'
    } else {
      connectString = 'myatp_high'
    }
  }

  if (!user || !password) {
    throw new Error(
      `Missing DB credentials in config/${environment}/.env. ` +
        'Set DB_ADMIN_USERNAME and DB_ADMIN_PASSWORD',
    )
  }

  logger.info(`Connecting to ${connectString} as ${user}...`)
  logger.muted(`Wallet: ${walletPath}`)

  let connection: oracledb.Connection | undefined
  let outputStream: ReturnType<typeof createWriteStream> | undefined

  try {
    // Set TNS_ADMIN for wallet lookup
    const originalTNS_ADMIN = process.env.TNS_ADMIN
    process.env.TNS_ADMIN = walletPath

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

    const connectionTimeout = 30000 // 30 second timeout
    let timeoutId: NodeJS.Timeout | undefined

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(
              `Connection timeout after ${connectionTimeout / 1000}s - check network/firewall or credentials`,
            ),
          )
        }, connectionTimeout)
      })

      // Race between connection and timeout
      connection = await Promise.race([oracledb.getConnection(connectionConfig), timeoutPromise])
    } catch (primaryError) {
      // Fallback: try without explicit wallet config
      try {
        connection = await oracledb.getConnection({ user, password, connectString })
      } catch {
        throw primaryError
      }
    } finally {
      // Clear the timeout to prevent process from hanging
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      // Restore original TNS_ADMIN
      if (originalTNS_ADMIN === undefined) {
        delete process.env.TNS_ADMIN
      } else {
        process.env.TNS_ADMIN = originalTNS_ADMIN
      }
    }

    logger.success('Connected to database')

    // Setup output
    let absoluteOutputPath: string | undefined
    if (outputFile) {
      absoluteOutputPath = path.isAbsolute(outputFile)
        ? outputFile
        : path.resolve(process.cwd(), outputFile)
      mkdirSync(path.dirname(absoluteOutputPath), { recursive: true })
      outputStream = createWriteStream(absoluteOutputPath, { flags: 'w' })
      logger.info(`Output will be saved to: ${absoluteOutputPath}`)
    }

    // Enable DBMS_OUTPUT
    try {
      await enableDbmsOutput(connection)
      logger.muted('DBMS_OUTPUT enabled')
    } catch {
      logger.warn('Could not enable DBMS_OUTPUT; continuing without it')
    }

    // Read and parse SQL file
    const sqlContent = readFileSync(absoluteInputPath, 'utf8')
    const statements = parseSqlStatements(sqlContent)

    if (statements.length === 0) {
      logger.warn('No SQL statements found in file')
      return
    }

    logger.info(`Executing ${statements.length} statement(s)...`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      logger.muted(`  [${i + 1}/${statements.length}] Executing...`)

      try {
        await connection.execute(stmt, {}, { autoCommit: true })

        // Capture DBMS_OUTPUT
        try {
          const outputLines = await drainDbmsOutput(connection)
          for (const line of outputLines) {
            console.log(line)
            if (outputStream) {
              outputStream.write(line + '\n')
            }
          }
        } catch {
          // Ignore DBMS_OUTPUT failures
        }
      } catch (err) {
        logger.error(`Failed to execute statement ${i + 1}:`)
        logger.error(stmt.substring(0, 200) + (stmt.length > 200 ? '...' : ''))
        throw err
      }
    }

    logger.success(`Successfully executed ${statements.length} statement(s)`)
    if (absoluteOutputPath) {
      logger.success(`Output saved to: ${absoluteOutputPath}`)
    }
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Database error: ${error.message}`)

      // Helpful hints for common errors
      if (error.message.includes('unable to initiate TLS')) {
        logger.info('TLS connection failed. Verify wallet is correct and database is running.')
      } else if (error.message.includes('NJS-521')) {
        logger.info('Connection string not found in tnsnames.ora')
      }
    }
    throw error
  } finally {
    if (outputStream) {
      await new Promise<void>((resolve, reject) => {
        outputStream!.end((err: NodeJS.ErrnoException | null) => {
          if (err) reject(err)
          else resolve()
        })
      })
    }

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

// ============================================================================
// Command Registration
// ============================================================================

export const registerDbRunCommand = (program: Command) => {
  program
    .command('db-run')
    .alias('dr')
    .description('Execute a SQL file against the database')
    .argument('<inputFile>', 'SQL file to execute')
    .argument('[outputFile]', 'Optional output file for DBMS_OUTPUT (prints to console if omitted)')
    .option('-e, --environment <env>', 'Environment name (default: from config.yaml)')
    .action(
      async (
        inputFile: string,
        outputFile: string | undefined,
        options: { environment?: string },
      ) => {
        const environment = options.environment || getDefaultEnvironment()
        try {
          await runSqlFile(environment, inputFile, outputFile)
        } catch {
          process.exit(1)
        }
      },
    )
}
