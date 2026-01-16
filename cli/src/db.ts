import oracledb from 'oracledb'
import fs from 'fs'
import path from 'path'
import os from 'os'
import dotenv from 'dotenv'
import unzipper from 'unzipper'
import prompts from 'prompts'
import { execSync, spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { rootDir, logger } from './index.js'

// Thin mode is default — no client install required
// Don't initialize the Oracle Client library (use Thin mode)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

// ============================================================================
// Database Configuration & Connection
// ============================================================================

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
  // Match bind variables that start with a letter (Oracle bind vars must start with a letter)
  // This avoids matching timestamps like 13:36:55 where :36 and :55 would be incorrectly matched
  const regex = /:([a-zA-Z]\w*)/g
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

// ============================================================================
// SQL Parsing & Execution
// ============================================================================

/**
 * Recursively resolve @include directives in SQL content
 * Replaces @path/to/file.sql with the file contents
 * Handles nested includes and circular references
 */
function resolveIncludes(
  content: string,
  baseDir: string,
  processedFiles: Set<string> = new Set(),
): string {
  const lines: string[] = []
  const contentLines = content.split('\n')

  for (const line of contentLines) {
    const trimmed = line.trim()

    // Check for @file directive (SQLPlus/SQLcl include syntax)
    if (trimmed.startsWith('@')) {
      const includePath = trimmed.substring(1).trim()

      // Resolve relative to baseDir
      const absoluteIncludePath = path.isAbsolute(includePath)
        ? includePath
        : path.resolve(baseDir, includePath)

      // Check for circular includes
      if (processedFiles.has(absoluteIncludePath)) {
        logger.warn(`Skipping circular include: ${absoluteIncludePath}`)
        continue
      }

      // Check if file exists
      if (!fs.existsSync(absoluteIncludePath)) {
        logger.warn(`Include file not found: ${absoluteIncludePath}`)
        continue
      }

      logger.muted(`  Including: ${path.relative(baseDir, absoluteIncludePath)}`)

      // Mark as processed
      processedFiles.add(absoluteIncludePath)

      // Load and recursively process the included file
      const includeContent = fs.readFileSync(absoluteIncludePath, 'utf8')
      const includeDir = path.dirname(absoluteIncludePath)
      const resolvedContent = resolveIncludes(includeContent, includeDir, processedFiles)

      // Append resolved content (with newlines for safety)
      lines.push('')
      lines.push(resolvedContent)
      lines.push('')
    } else {
      lines.push(line)
    }
  }

  return lines.join('\n')
}

/**
 * Parse SQL file content into individual executable statements.
 * Handles:
 * - PL/SQL blocks (BEGIN...END, CREATE PACKAGE, etc.) terminated by / on its own line
 * - Single SQL statements terminated by ; (but not ; inside PL/SQL blocks)
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
      // Remove trailing semicolon for oracledb (it doesn't like them)
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
  outputFile?: string,
): Promise<void> {
  // Resolve absolute path to SQL file
  const absoluteSqlPath = path.isAbsolute(sqlFilePath)
    ? sqlFilePath
    : path.join(rootDir, sqlFilePath)

  if (!fs.existsSync(absoluteSqlPath)) {
    throw new Error(`SQL file not found: ${absoluteSqlPath}`)
  }

  // Resolve output file path if provided
  let absoluteOutputPath: string | undefined
  if (outputFile) {
    absoluteOutputPath = path.isAbsolute(outputFile)
      ? outputFile
      : path.resolve(rootDir, outputFile)
    // Create output directory if it doesn't exist
    const outputDir = path.dirname(absoluteOutputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
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
  let outputStream: ReturnType<typeof createWriteStream> | undefined
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

    // Initialize output stream if file path provided
    if (absoluteOutputPath) {
      outputStream = createWriteStream(absoluteOutputPath, { flags: 'w' })
      logger.info(`DBMS output will be saved to: ${absoluteOutputPath}`)
    }

    try {
      await enableDbmsOutput(connection)
      logger.muted('DBMS_OUTPUT enabled')
    } catch {
      // Not fatal; some environments/users may not have DBMS_OUTPUT.
      logger.warn('Could not enable DBMS_OUTPUT; continuing without it')
    }

    // Read SQL file
    let sqlContent = fs.readFileSync(absoluteSqlPath, 'utf8')

    // Resolve @include directives (SQLPlus/SQLcl syntax)
    logger.info('Resolving includes...')
    const sqlDir = path.dirname(absoluteSqlPath)
    sqlContent = resolveIncludes(sqlContent, sqlDir)

    // Parse SQL statements - handles both:
    // 1. PL/SQL blocks terminated by / on its own line
    // 2. Single SQL statements terminated by ;
    const statements = parseSqlStatements(sqlContent)

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

        // Capture DBMS_OUTPUT emitted by this statement (if any)
        try {
          const outputLines = await drainDbmsOutput(connection)
          for (const line of outputLines) {
            logger.log(line)
            // Also write to output file if specified
            if (outputStream) {
              outputStream.write(line + '\n')
            }
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
    if (outputStream) {
      logger.success(`Output saved to: ${absoluteOutputPath}`)
    }
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
    // Close output stream if it was created
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
// Schema Export/Import
// ============================================================================

/**
 * Export schema to JSON file using odbvue.export_schema
 * - Connects to database and calls odbvue.export_schema
 * - Captures DBMS_OUTPUT and writes to outputFile
 */
export async function exportSchema(
  project: string,
  environment: string,
  outputFile: string,
): Promise<void> {
  // Load environment config
  const env = loadEnv(project, environment)

  const walletBasePath = path.join(rootDir, 'config', project, environment, '.wallets')
  const user = env.DB_ADMIN_USERNAME
  const password = env.DB_ADMIN_PASSWORD
  const connectString = env.DB_CONNECT_STRING || 'myatp_high'
  const schemaUsername = env.DB_SCHEMA_USERNAME

  if (!user || !password) {
    throw new Error(
      `Missing DB credentials in ${project}/${environment} config. ` +
        'Set DB_ADMIN_USERNAME and DB_ADMIN_PASSWORD in .env',
    )
  }

  if (!schemaUsername) {
    throw new Error(`Missing DB_SCHEMA_USERNAME in ${project}/${environment} config.`)
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
      try {
        const fallbackConfig: Record<string, unknown> = {
          user,
          password,
          connectString,
        }
        connection = await oracledb.getConnection(fallbackConfig)
      } catch {
        throw primaryError
      }
    } finally {
      if (originalTNS_ADMIN === undefined) {
        delete process.env.TNS_ADMIN
      } else {
        process.env.TNS_ADMIN = originalTNS_ADMIN
      }
    }

    logger.success('Connected to database')

    // Enable DBMS_OUTPUT
    await enableDbmsOutput(connection)
    logger.muted('DBMS_OUTPUT enabled')

    // First, ensure odbvue package exists by running create_odbvue.sql
    const createOdbvuePath = path.join(rootDir, 'db', 'utils', 'create_odbvue.sql')
    if (fs.existsSync(createOdbvuePath)) {
      logger.info('Creating/updating odbvue package...')
      const createSql = fs.readFileSync(createOdbvuePath, 'utf8')
      const statements = parseSqlStatements(createSql)
      for (const stmt of statements) {
        try {
          await connection.execute(stmt, {}, { autoCommit: true })
        } catch (err) {
          // Log but continue - package might already exist
          logger.warn(`Warning creating package: ${err instanceof Error ? err.message : err}`)
        }
      }
    }

    // Call odbvue.export_schema
    logger.info(`Exporting schema: ${schemaUsername}...`)
    const exportSql = `BEGIN odbvue.export_schema(:schema_username); END;`
    await connection.execute(exportSql, { schema_username: schemaUsername }, { autoCommit: true })

    // Drain DBMS_OUTPUT to get the JSON
    const outputLines = await drainDbmsOutput(connection)
    const jsonOutput = outputLines.join('\n')

    // Resolve output file path
    const absoluteOutputPath = path.isAbsolute(outputFile)
      ? outputFile
      : path.resolve(rootDir, outputFile)

    // Create output directory if it doesn't exist
    const outputDir = path.dirname(absoluteOutputPath)
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // Write JSON to file
    fs.writeFileSync(absoluteOutputPath, jsonOutput, 'utf8')
    logger.success(`Schema exported to: ${absoluteOutputPath}`)
  } catch (error) {
    if (error instanceof Error) {
      logger.error(`Database error: ${error.message}`)
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

/**
 * Import schema from JSON file using odbvue.import_schema
 * - Reads JSON file
 * - Connects to database and calls odbvue.import_schema
 * - Captures DBMS_OUTPUT (generated SQL) and writes to outputFile
 */
export async function importSchema(
  project: string,
  environment: string,
  inputFile: string,
  outputFile: string,
): Promise<void> {
  // Resolve input file path
  const absoluteInputPath = path.isAbsolute(inputFile)
    ? inputFile
    : path.resolve(rootDir, inputFile)

  if (!fs.existsSync(absoluteInputPath)) {
    throw new Error(`Input JSON file not found: ${absoluteInputPath}`)
  }

  logger.info(`Reading JSON schema from: ${inputFile}`)

  // Read and parse JSON file
  const jsonContent = fs.readFileSync(absoluteInputPath, 'utf8')
  const schema = JSON.parse(jsonContent)

  logger.info(`Generating SQL for schema: ${schema.schema}...`)

  // Generate SQL DDL
  const sql = generateSqlFromSchema(schema)

  // Resolve output file path
  const absoluteOutputPath = path.isAbsolute(outputFile)
    ? outputFile
    : path.resolve(rootDir, outputFile)

  // Create output directory if it doesn't exist
  const outputDir = path.dirname(absoluteOutputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Write SQL to file
  fs.writeFileSync(absoluteOutputPath, sql, 'utf8')
  logger.success(`SQL generated: ${absoluteOutputPath}`)
}

// ============================================================================
// JSON to SQL Generation
// ============================================================================

interface SchemaColumn {
  name: string
  type: string
  default: string | null
  nullable: boolean
  identity: boolean
}

interface SchemaTable {
  name: string
  columns: SchemaColumn[]
  primary_key?: string[]
  unique?: string[][]
  indexes?: string[][]
  foreignKeys?: {
    columns: string[]
    refTable: string
    refColumns: string[]
    onDelete?: string
  }[]
}

interface SchemaDefinition {
  schema: string
  exported: string
  tables: SchemaTable[]
}

function generateSqlFromSchema(schema: SchemaDefinition): string {
  const lines: string[] = []
  const schemaName = schema.schema

  // Header
  lines.push(`-- Schema: ${schemaName}`)
  lines.push(`-- Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`)
  lines.push('-- Idempotent DDL - safe to run multiple times')
  lines.push('')

  let uqConstraintNum = 0
  let fkConstraintNum = 0

  // First pass: Create all tables with columns and primary keys
  for (const table of schema.tables) {
    lines.push(`-- Table: ${table.name}`)
    lines.push('DECLARE')
    lines.push('    v_exists NUMBER;')
    lines.push('BEGIN')
    lines.push(
      `    SELECT COUNT(*) INTO v_exists FROM all_tables WHERE owner = '${schemaName}' AND table_name = '${table.name}';`,
    )
    lines.push('    IF v_exists = 0 THEN')
    lines.push("        EXECUTE IMMEDIATE '")

    lines.push(`CREATE TABLE ${schemaName}.${table.name} (`)

    // Add columns
    for (let i = 0; i < table.columns.length; i++) {
      const col = table.columns[i]
      const prefix = i === 0 ? '            ' : '           ,'
      let colDef = `${prefix}${col.name} ${col.type}`

      if (col.identity) {
        colDef += ' GENERATED BY DEFAULT AS IDENTITY'
      }

      if (col.default && col.default.trim() !== '') {
        // For VARCHAR2 and CHAR types, escape quotes for EXECUTE IMMEDIATE string context
        const isStringType = col.type.includes('VARCHAR2') || col.type.includes('CHAR')
        if (isStringType && !col.default.includes('(') && !col.default.includes(')')) {
          // Double the quotes for EXECUTE IMMEDIATE string context: 'A' becomes ''A''
          colDef += ` DEFAULT ''${col.default.replace(/'/g, "''")}''`
        } else {
          colDef += ` DEFAULT ${col.default}`
        }
      }

      if (!col.nullable) {
        colDef += ' NOT NULL'
      }

      lines.push(colDef)
    }

    // Add primary key constraint inline
    if (table.primary_key && table.primary_key.length > 0) {
      const pkConstraintName = `PK_${table.name}`
      const pkCols = table.primary_key.join(', ')
      lines.push(`           ,CONSTRAINT ${pkConstraintName} PRIMARY KEY (${pkCols})`)
    }

    lines.push("        )';")
    lines.push('    END IF;')
    lines.push('END;')
    lines.push('/')
    lines.push('')
  }

  // Second pass: Add unique constraints
  for (const table of schema.tables) {
    if (!table.unique || table.unique.length === 0) continue

    for (const uniqueCols of table.unique) {
      if (!uniqueCols || uniqueCols.length === 0) continue

      uqConstraintNum++
      const uqConstraintName = `UQ_${table.name}_${uqConstraintNum}`
      const colList = uniqueCols.join(',')

      lines.push('DECLARE')
      lines.push('    v_exists NUMBER;')
      lines.push('BEGIN')
      lines.push('    -- Check if unique constraint on these columns already exists')
      lines.push('    SELECT COUNT(*) INTO v_exists FROM all_constraints ac')
      lines.push(`    WHERE ac.owner = '${schemaName}'`)
      lines.push(`      AND ac.table_name = '${table.name}'`)
      lines.push("      AND ac.constraint_type IN ('U', 'P')")
      lines.push(
        "      AND (SELECT LISTAGG(acc.column_name, ',') WITHIN GROUP (ORDER BY acc.position)",
      )
      lines.push(
        `           FROM all_cons_columns acc WHERE acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name) = '${colList}';`,
      )
      lines.push('    IF v_exists = 0 THEN')
      lines.push(
        `        EXECUTE IMMEDIATE 'ALTER TABLE ${schemaName}.${table.name} ADD CONSTRAINT ${uqConstraintName} UNIQUE (${uniqueCols.join(', ')})';`,
      )
      lines.push('    END IF;')
      lines.push('END;')
      lines.push('/')
      lines.push('')
    }
  }

  // Third pass: Create indexes (only if indexes is properly formatted array of arrays)
  for (const table of schema.tables) {
    if (!table.indexes || table.indexes.length === 0) continue

    for (let idx = 0; idx < table.indexes.length; idx++) {
      const indexCols = table.indexes[idx]
      if (!Array.isArray(indexCols) || indexCols.length === 0) continue

      const idxName = `IDX_${table.name}_${idx + 1}`

      lines.push('DECLARE')
      lines.push('    v_exists NUMBER;')
      lines.push('BEGIN')
      lines.push(
        `    SELECT COUNT(*) INTO v_exists FROM all_indexes WHERE owner = '${schemaName}' AND index_name = '${idxName}';`,
      )
      lines.push('    IF v_exists = 0 THEN')
      lines.push(
        `        EXECUTE IMMEDIATE 'CREATE INDEX ${schemaName}.${idxName} ON ${schemaName}.${table.name} (${indexCols.join(', ')})';`,
      )
      lines.push('    END IF;')
      lines.push('END;')
      lines.push('/')
      lines.push('')
    }
  }

  // Fourth pass: Add foreign key constraints
  for (const table of schema.tables) {
    if (!table.foreignKeys || table.foreignKeys.length === 0) continue

    for (const fk of table.foreignKeys) {
      fkConstraintNum++
      const fkConstraintName = `FK_${table.name}_${fkConstraintNum}`

      lines.push('DECLARE')
      lines.push('    v_exists NUMBER;')
      lines.push('BEGIN')
      lines.push(
        `    SELECT COUNT(*) INTO v_exists FROM all_constraints WHERE owner = '${schemaName}' AND constraint_name = '${fkConstraintName}';`,
      )
      lines.push('    IF v_exists = 0 THEN')

      let fkSql = `        EXECUTE IMMEDIATE 'ALTER TABLE ${schemaName}.${table.name} ADD CONSTRAINT ${fkConstraintName} FOREIGN KEY (${fk.columns.join(', ')}) REFERENCES ${schemaName}.${fk.refTable} (${fk.refColumns.join(', ')})`

      if (fk.onDelete) {
        if (fk.onDelete === 'cascade') {
          fkSql += ' ON DELETE CASCADE'
        } else if (fk.onDelete === 'setNull') {
          fkSql += ' ON DELETE SET NULL'
        }
      }

      fkSql += "';"
      lines.push(fkSql)
      lines.push('    END IF;')
      lines.push('END;')
      lines.push('/')
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ============================================================================
// SQL Scaffolding
// ============================================================================

/**
 * Generate SQL scaffold from a TypeScript API module
 * Returns the path to the generated SQL file
 */
export async function scaffoldModule(apiPath: string, outputDir?: string): Promise<string> {
  const absoluteApiPath = path.isAbsolute(apiPath) ? apiPath : path.resolve(rootDir, apiPath)

  if (!fs.existsSync(absoluteApiPath)) {
    throw new Error(`API file not found: ${absoluteApiPath}`)
  }

  const moduleName = path.basename(path.dirname(absoluteApiPath))
  const apiDir = path.dirname(absoluteApiPath)
  const distDir = outputDir || path.resolve(apiDir, 'dist')

  // Find the project root that contains tsconfig.json with path mappings
  // Walk up from the API file to find the nearest tsconfig.json
  let projectRoot = apiDir
  let tsconfigPath = ''
  while (projectRoot !== path.dirname(projectRoot)) {
    // Prefer tsconfig.app.json if it exists (has path aliases in Vue projects)
    const appConfig = path.join(projectRoot, 'tsconfig.app.json')
    const baseConfig = path.join(projectRoot, 'tsconfig.json')
    if (fs.existsSync(appConfig)) {
      tsconfigPath = appConfig
      break
    }
    if (fs.existsSync(baseConfig)) {
      tsconfigPath = baseConfig
      break
    }
    projectRoot = path.dirname(projectRoot)
  }

  // Create dist directory if it doesn't exist
  fs.mkdirSync(distDir, { recursive: true })

  // Create a temporary loader script
  const fileUrl = `file://${absoluteApiPath.replace(/\\/g, '/')}`
  const loaderScript = `import('${fileUrl}').then(m => {
  const schema = m.schema;
  const tables = m.tables || [];
  const packages = m.packages || [];
  const sqlParts = [];
  
  if (schema && typeof schema.render === 'function') {
    sqlParts.push(schema.render());
  }
  
  for (const table of tables) {
    if (typeof table.render === 'function') {
      sqlParts.push(table.render());
    }
  }
  
  for (const pkg of packages) {
    if (typeof pkg.render === 'function') {
      sqlParts.push(pkg.render());
    }
  }
  
  console.log(JSON.stringify({ sqlParts, tableCount: tables.length, packageCount: packages.length }));
}).catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});`

  const loaderPath = path.resolve(os.tmpdir(), `ov-scaffold-${Date.now()}.mjs`)
  fs.writeFileSync(loaderPath, loaderScript, 'utf-8')

  try {
    let result: string
    try {
      const tsxCmd = tsconfigPath
        ? `npx tsx --tsconfig "${tsconfigPath}" ${loaderPath}`
        : `npx tsx ${loaderPath}`
      result = execSync(tsxCmd, {
        cwd: projectRoot,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (execError) {
      const err = execError as { stderr?: string; stdout?: string; message?: string }
      logger.error(`Scaffold execution failed:`)
      if (err.stderr) logger.error(err.stderr)
      if (err.stdout) logger.muted(err.stdout)
      throw new Error(err.message || 'Failed to execute scaffold script')
    }

    const jsonMatch = result.match(/\{.*\}/s)
    if (!jsonMatch) {
      throw new Error('No JSON output found from loader script')
    }

    const output = JSON.parse(jsonMatch[0])

    if (output.error) {
      throw new Error(output.error)
    }

    const { sqlParts, tableCount, packageCount } = output

    if (tableCount === 0 && packageCount === 0) {
      logger.warn(`No tables or packages exported from ${moduleName}`)
    }

    if (sqlParts.length > 0) {
      const sqlContent = sqlParts.join('\n\n')
      const outputPath = path.resolve(distDir, 'index.sql')
      fs.writeFileSync(outputPath, sqlContent, 'utf-8')
      logger.success(
        `Scaffolded ${moduleName} → ${path.relative(rootDir, outputPath)} (${tableCount} tables, ${packageCount} packages)`,
      )
      return outputPath
    }

    throw new Error(`No SQL content generated from ${moduleName}`)
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(loaderPath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Generate consolidated SQL file from folder structure
 * Scans predefined subfolders and warns if SQL files are found in other locations
 */
function generateSqlFromFolder(folderPath: string, folderName: string): string {
  const subfolders = [
    'scripts/before',
    'tables',
    'types',
    'sequences',
    'packages/specs',
    'packages/bodies',
    'triggers',
    'scripts/after',
  ]
  const sqlLines: string[] = []

  for (const subfolder of subfolders) {
    const subfolderPath = path.join(folderPath, subfolder)

    if (!fs.existsSync(subfolderPath)) {
      continue
    }

    const files = fs.readdirSync(subfolderPath, { recursive: false })
    const sqlFiles = files
      .filter((file): file is string => typeof file === 'string' && file.endsWith('.sql'))
      .sort()

    for (const sqlFile of sqlFiles) {
      const relativePath = `./${subfolder}/${sqlFile}`
      sqlLines.push(`@${relativePath}`)
    }
  }

  // Check for SQL files in other subfolders
  const allEntries = fs.readdirSync(folderPath)
  for (const entry of allEntries) {
    const entryPath = path.join(folderPath, entry)
    const stats = fs.statSync(entryPath)

    if (stats.isDirectory() && !subfolders.includes(entry)) {
      const files = fs.readdirSync(entryPath, { recursive: false })
      const sqlFiles = files.filter(
        (file): file is string => typeof file === 'string' && file.endsWith('.sql'),
      )

      if (sqlFiles.length > 0) {
        logger.warn(
          `Found ${sqlFiles.length} SQL file(s) in unregistered subfolder: ./${entry}/ (not included in consolidation)`,
        )
      }
    }
  }

  // Generate output file in the folder
  const outputPath = path.join(folderPath, `${folderName}.sql`)
  const content = sqlLines.join('\n')
  fs.writeFileSync(outputPath, content, 'utf-8')

  logger.info(`Generated ${folderName}.sql with ${sqlLines.length} include(s)`)
  return outputPath
}

/**
 * Run a file or folder against the database
 * - If .ts file: first scaffold to SQL, then execute
 * - If .sql file: execute directly
 * - If folder: generate consolidated SQL file, then execute
 */
export async function runFile(
  project: string,
  environment: string,
  filePath: string,
  outputFile?: string,
): Promise<void> {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(rootDir, filePath)

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Path not found: ${absolutePath}`)
  }

  const stats = fs.statSync(absolutePath)

  if (stats.isDirectory()) {
    // Folder - generate consolidated SQL and run
    const folderName = path.basename(absolutePath)
    logger.info(`Consolidating SQL files from folder: ${absolutePath}`)
    const sqlPath = generateSqlFromFolder(absolutePath, folderName)
    logger.info(`Running consolidated SQL: ${sqlPath}`)
    await runSqlFile(project, environment, sqlPath, outputFile)
  } else {
    const ext = path.extname(absolutePath).toLowerCase()

    if (ext === '.ts') {
      // TypeScript file - scaffold first, then run the generated SQL
      logger.info(`Scaffolding TypeScript module: ${absolutePath}`)
      const sqlPath = await scaffoldModule(absolutePath)
      logger.info(`Running generated SQL: ${sqlPath}`)
      await runSqlFile(project, environment, sqlPath, outputFile)
    } else if (ext === '.sql') {
      // SQL file - run directly
      await runSqlFile(project, environment, absolutePath, outputFile)
    } else {
      throw new Error(`Unsupported file type: ${ext}. Expected .ts or .sql`)
    }
  }
}

// ============================================================================
// Local Database (Podman/Docker) Management
// ============================================================================

const getDbLocalDir = () => path.resolve(rootDir, 'i13e/db/local')

/**
 * Get the podman command if available
 */
export function getPodmanCommand(): string | null {
  try {
    execSync('podman --version', { stdio: 'pipe' })
    return 'podman'
  } catch {
    return null
  }
}

/**
 * Check if Podman is installed
 */
async function checkPodmanInstalled(): Promise<boolean> {
  try {
    execSync('podman --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Check if Podman daemon is running
 */
async function checkPodmanRunning(): Promise<boolean> {
  try {
    execSync('podman info', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Start Podman machine
 */
async function startPodmanMachine(): Promise<boolean> {
  try {
    logger.info('Starting Podman machine...')
    execSync('podman machine start', { stdio: 'inherit' })
    logger.success('Podman machine started')
    return true
  } catch {
    logger.error('Failed to start Podman machine')
    return false
  }
}

/**
 * Check Podman system resources and warn if below recommended
 */
async function checkPodmanResources(): Promise<void> {
  try {
    const info = execSync('podman system info --format json', { stdio: 'pipe' }).toString()
    const systemInfo = JSON.parse(info)

    const cpus = systemInfo.host?.cpus || 0
    const memoryBytes = systemInfo.host?.memFree || 0
    const memoryGb = memoryBytes / (1024 * 1024 * 1024)

    if (cpus < 4 || memoryGb < 8) {
      logger.warn(
        `Podman resources below recommended: ${cpus} CPU(s), ${memoryGb.toFixed(2)} GB RAM`,
      )
      logger.warn('Recommended: 4 CPU(s) and 8 GB RAM')
    }
  } catch {
    // Silently fail if unable to check resources
  }
}

/**
 * Wait for a container to reach healthy status
 */
async function waitForContainerHealth(
  podmanCmd: string,
  containerName: string,
  timeoutMs: number = 600000, // 10 minutes default
  intervalMs: number = 5000, // 5 seconds between checks
): Promise<void> {
  const startTime = Date.now()

  const getContainerStatus = (): string | null => {
    try {
      const result = execSync(
        `${podmanCmd} inspect --format "{{.State.Health.Status}}" ${containerName}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim()
      return result
    } catch {
      // Container might not exist yet or no health check defined
      try {
        const running = execSync(
          `${podmanCmd} inspect --format "{{.State.Running}}" ${containerName}`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim()
        return running === 'true' ? 'running' : 'not-running'
      } catch {
        return null
      }
    }
  }

  return new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > timeoutMs) {
        reject(new Error(`Timeout waiting for container ${containerName} to be up and ready`))
        return
      }

      const status = getContainerStatus()

      if (status === 'healthy') {
        resolve()
        return
      }

      setTimeout(check, intervalMs)
    }

    check()
  })
}

/**
 * Download wallet ZIP file from a running container
 */
async function downloadWalletZipFromContainer(
  podmanCmd: string,
  containerName: string,
  outputZipPath: string,
): Promise<void> {
  fs.mkdirSync(path.dirname(outputZipPath), { recursive: true })

  const zipCommand = [
    'set -euo pipefail',
    'cd /u01/app/oracle/wallets/tls_wallet',
    'shopt -s dotglob',
    'zip -r -X -q - *',
  ].join(' && ')

  await new Promise<void>((resolve, reject) => {
    const child = spawn(podmanCmd, ['exec', containerName, 'bash', '-lc', zipCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const output = createWriteStream(outputZipPath)
    child.stdout?.pipe(output)

    let stderr = ''
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (error) => reject(error))
    child.on('exit', (code) => {
      output.close()
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr || `podman exec exited with code ${code}`))
      }
    })
  })
}

/**
 * Get list of all database containers (running and stopped)
 */
async function getDatabaseContainers(podmanCmd: string): Promise<string[]> {
  try {
    const output = execSync(`${podmanCmd} ps -a --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return output.split('\n').filter((name) => name && name.includes('db'))
  } catch {
    return []
  }
}

/**
 * Get list of running database containers
 */
async function getRunningDatabaseContainers(podmanCmd: string): Promise<string[]> {
  try {
    const output = execSync(`${podmanCmd} ps --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return output.split('\n').filter((name) => name && name.includes('db'))
  } catch {
    return []
  }
}

/**
 * Wait for database container to reach healthy status
 */
async function waitForDatabaseReady(podmanCmd: string, containerName: string): Promise<void> {
  logger.info('Waiting for database to be up and ready...')
  logger.muted('This may take a few minutes while the database initializes. Please wait...\n')
  try {
    await waitForContainerHealth(podmanCmd, containerName)
    logger.success('Database is up and ready')
  } catch (error) {
    logger.error(`${error}`)
    process.exit(1)
  }
}

/**
 * Remove a local database container
 */
export async function removeLocalDatabase(containerName?: string): Promise<void> {
  logger.info('Removing local Oracle Database container...')

  const podmanCmd = getPodmanCommand()
  if (!podmanCmd) {
    logger.error('Podman command not found')
    process.exit(1)
  }

  const podmanRunning = await checkPodmanRunning()
  if (!podmanRunning) {
    logger.error('Podman is not running')
    process.exit(1)
  }

  let targetContainer = containerName

  if (!targetContainer) {
    const containers = await getRunningDatabaseContainers(podmanCmd)

    if (containers.length === 0) {
      logger.warn('No database containers found')
      return
    }

    if (containers.length === 1) {
      targetContainer = containers[0]
    } else {
      const response = await prompts({
        type: 'select',
        name: 'container',
        message: 'Select container to remove',
        choices: containers.map((c) => ({ title: c, value: c })),
      })
      targetContainer = response.container
    }
  }

  if (!targetContainer) {
    logger.error('No container selected')
    process.exit(1)
  }

  const confirm = await prompts({
    type: 'confirm',
    name: 'remove',
    message: `Are you sure you want to remove container "${targetContainer}"?`,
    initial: false,
  })

  if (!confirm.remove) {
    logger.info('Operation cancelled')
    return
  }

  try {
    execSync(`${podmanCmd} compose down`, { cwd: getDbLocalDir(), stdio: 'pipe' })
    logger.success(`Container "${targetContainer}" removed successfully`)
  } catch (error) {
    logger.error(`Failed to remove container: ${error}`)
    process.exit(1)
  }
}

/**
 * Validate Oracle password meets complexity requirements
 */
function validatePassword(password: string): boolean | string {
  if (password.length < 12) {
    return 'Password must be at least 12 characters'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one symbol'
  }
  return true
}

/**
 * Setup local Oracle Database using Podman/Docker
 */
export async function setupLocalDatabase(
  project: string = 'odbvue',
  environment: string = 'dev',
): Promise<void> {
  logger.info(
    `Setting up local Oracle Database for project: ${project}, environment: ${environment}...`,
  )

  const podmanInstalled = await checkPodmanInstalled()
  if (!podmanInstalled) {
    logger.error('Podman is not installed')
    logger.warn('Please install Podman from: https://podman.io/docs/installation')
    process.exit(1)
  }

  logger.success('Podman is installed')

  const podmanRunning = await checkPodmanRunning()
  if (!podmanRunning) {
    logger.warn('Podman is not running')
    const response = await prompts({
      type: 'confirm',
      name: 'startPodman',
      message: 'Would you like to start Podman machine?',
      initial: true,
    })

    if (response.startPodman) {
      const started = await startPodmanMachine()
      if (!started) {
        logger.error('Cannot proceed without Podman running')
        process.exit(1)
      }
    } else {
      logger.error('Podman must be running to continue')
      process.exit(1)
    }
  }

  logger.success('Podman is running and ready')

  await checkPodmanResources()

  const getExampleConfigDir = () => path.resolve(rootDir, 'config', 'example', environment)
  const exampleConfigPath = path.resolve(getExampleConfigDir(), '.env.example')

  const getTargetConfigDir = () => path.resolve(rootDir, 'config', project, environment)

  if (!fs.existsSync(exampleConfigPath)) {
    logger.error(`Example .env file not found at: ${exampleConfigPath}`)
    process.exit(1)
  }

  // Load and display content as object from config/example/dev/.env.example
  const exampleConfigObject = dotenv.config({ path: exampleConfigPath }).parsed || {}

  const dbParams = await prompts([
    {
      type: 'text',
      name: 'containerName',
      message: 'CONTAINER_NAME',
      initial: `${project}-db-${environment}`,
      validate: (value) => (value.trim() ? true : 'Container name cannot be empty'),
    },
    {
      type: 'password',
      name: 'adminPassword',
      message: 'ADMIN_PASSWORD',
      initial: exampleConfigObject['DB_ADMIN_PASSWORD'] || 'MySecurePass123!',
      validate: validatePassword,
    },
    {
      type: 'password',
      name: 'walletPassword',
      message: 'WALLET_PASSWORD',
      initial: exampleConfigObject['DB_WALLET_PASSWORD'] || 'MySecurePass123!',
      validate: validatePassword,
    },
    {
      type: 'text',
      name: 'schemaName',
      message: 'SCHEMA_NAME',
      initial: 'ODBVUE',
    },
    {
      type: 'password',
      name: 'schemaPassword',
      message: 'SCHEMA_PASSWORD',
      initial: 'MySecurePass123!',
      validate: validatePassword,
    },
  ])

  // Generate .env file in config directory
  logger.info('Generating .env file...')
  fs.mkdirSync(getTargetConfigDir(), { recursive: true })
  const envPath = path.resolve(getTargetConfigDir(), '.env')
  const envContent = `DB_CONTAINER_NAME="${dbParams.containerName}"\nDB_ADMIN_USERNAME="ADMIN"\nDB_ADMIN_PASSWORD="${dbParams.adminPassword}"\nDB_WALLET_PASSWORD="${dbParams.walletPassword}"\nDB_SCHEMA_USERNAME="${dbParams.schemaName}"\nDB_SCHEMA_PASSWORD="${dbParams.schemaPassword}"`
  fs.writeFileSync(envPath, envContent, 'utf-8')
  logger.success(`Generated .env file at: ${envPath}`)

  // check if container with same name is already running
  const podmanCmd = getPodmanCommand()
  if (!podmanCmd) {
    logger.error('Podman command not found')
    process.exit(1)
  }

  const existingContainers = await getDatabaseContainers(podmanCmd)

  if (!existingContainers.includes(dbParams.containerName)) {
    try {
      const envFilePath = path.resolve(getTargetConfigDir(), '.env')
      execSync(`${podmanCmd} compose --env-file "${envFilePath}" up -d --build`, {
        cwd: getDbLocalDir(),
        stdio: 'pipe',
      })
      logger.success('Database container started')
    } catch (error) {
      logger.error(`Failed to start container: ${error}`)
      process.exit(1)
    }

    // Wait for container to be up and ready
    await waitForDatabaseReady(podmanCmd, dbParams.containerName)
  } else {
    logger.warn(`Container with name "${dbParams.containerName}" already exists.`)

    const existingRunningContainers = await getRunningDatabaseContainers(podmanCmd)
    if (!existingRunningContainers.includes(dbParams.containerName)) {
      const response = await prompts({
        type: 'confirm',
        name: 'startExisting',
        message: `The container "${dbParams.containerName}" is not running. Do you want to start it?`,
        initial: true,
      })

      if (response.startExisting) {
        // Start existing container
        logger.info(`Starting existing container "${dbParams.containerName}"...`)
        try {
          execSync(`${podmanCmd} start ${dbParams.containerName}`, { stdio: 'pipe' })
          logger.success(`Container "${dbParams.containerName}" started successfully`)
        } catch (error) {
          logger.error(`Failed to start container: ${error}`)
          process.exit(1)
        }

        // Wait for container to be up and ready
        await waitForDatabaseReady(podmanCmd, dbParams.containerName)
      } else {
        logger.info('Setup cancelled')
        process.exit(0)
      }
    }
  }

  // Download wallet
  logger.info('Downloading wallet from container...')
  const walletsDir = path.resolve(getTargetConfigDir(), '.wallets')
  const walletZipPath = path.resolve(walletsDir, `${dbParams.containerName}.zip`)

  try {
    await downloadWalletZipFromContainer(podmanCmd, dbParams.containerName, walletZipPath)
    logger.success(`Wallet downloaded and saved to: ${walletZipPath}`)
  } catch (error) {
    logger.error(`Failed to download wallet: ${error}`)
    process.exit(1)
  }

  // Final success message
  logger.success('Local database setup completed successfully!')
  logger.muted(`Oracle Rest Data Services is running at: https://localhost:8443/ords/`)
  logger.muted('Configure database connection: ')
  logger.muted(`  username: ADMIN`)
  logger.muted(`  password: ************`)
  logger.muted(`  wallet: ${walletZipPath}`)
  logger.muted('')
}
