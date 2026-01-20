import { Command } from 'commander'
import oracledb from 'oracledb'
import {
  logger,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  getDefaultEnvironment,
} from '../utils.js'
import os from 'os'

// Thin mode - no Oracle client install required
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

// ============================================================================
// Types
// ============================================================================

type ColumnInfo = {
  name: string
  description?: string
  type: string
  default: string | null
  required: boolean
  identity: boolean
}

type TableInfo = {
  name: string
  description?: string
  columns: ColumnInfo[]
  primary_key: string[]
  unique?: string[][]
  indexes?: string[][] | null
  checks?: Array<{
    column: string
    values: string[]
  }> | null
  foreignKeys?: Array<{
    name: string
    column: string
    referenceTable: string
    referenceColumn: string
  }> | null
}

type SchemaJson = {
  schema: string
  exported: string
  tables: TableInfo[]
}

type DbEnv = {
  DB_ADMIN_USERNAME?: string
  DB_ADMIN_PASSWORD?: string
  DB_WALLET_PATH?: string
  DB_WALLET_PASSWORD?: string
  DB_CONNECT_STRING?: string
  [key: string]: string | undefined
}

type DiffResult = {
  newTables: TableInfo[]
  droppedTables: string[]
  modifiedTables: {
    name: string
    newColumns: ColumnInfo[]
    droppedColumns: string[]
    modifiedColumns: {
      name: string
      from: Partial<ColumnInfo>
      to: Partial<ColumnInfo>
    }[]
    newIndexes: string[][]
    droppedIndexes: string[][]
    newConstraints: {
      type: 'UNIQUE' | 'CHECK' | 'FOREIGN KEY'
      definition: string
    }[]
    droppedConstraints: string[]
  }[]
}

// ============================================================================
// Environment & Configuration
// ============================================================================

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

function getWalletPath(env: DbEnv, environment: string): string {
  const walletPath = env.DB_WALLET_PATH
  if (!walletPath) {
    throw new Error('DB_WALLET_PATH not set in environment config')
  }

  const configDir = path.join(rootDir, 'config', environment)

  let resolvedPath: string
  if (walletPath.startsWith('./') || walletPath.startsWith('../')) {
    resolvedPath = path.resolve(configDir, walletPath)
  } else {
    resolvedPath = walletPath
  }

  // If it's a zip file that's already extracted
  if (resolvedPath.endsWith('.zip')) {
    const extractedDir = resolvedPath.replace('.zip', '')
    if (existsSync(path.join(extractedDir, 'tnsnames.ora'))) {
      return extractedDir
    }
  }

  return resolvedPath
}

// ============================================================================
// Database Introspection
// ============================================================================

async function fetchDbSchema(
  connection: oracledb.Connection,
  schemaName: string,
): Promise<TableInfo[]> {
  const tables: TableInfo[] = []

  // Get all tables
  const tablesResult = await connection.execute<{
    TABLE_NAME: string
    COMMENTS: string | null
  }>(
    `SELECT t.table_name, c.comments
     FROM all_tables t
     LEFT JOIN all_tab_comments c ON t.owner = c.owner AND t.table_name = c.table_name
     WHERE t.owner = :owner
     ORDER BY t.table_name`,
    { owner: schemaName },
  )

  for (const row of tablesResult.rows || []) {
    const tableName = row.TABLE_NAME
    const tableDescription = row.COMMENTS || undefined

    // Get columns
    const columnsResult = await connection.execute<{
      COLUMN_NAME: string
      DATA_TYPE: string
      DATA_LENGTH: number
      DATA_PRECISION: number | null
      DATA_SCALE: number | null
      NULLABLE: string
      DATA_DEFAULT: string | null
      IDENTITY_COLUMN: string
      COMMENTS: string | null
      CHAR_USED: string | null
    }>(
      `SELECT c.column_name, c.data_type, c.data_length, c.data_precision, c.data_scale,
              c.nullable, c.data_default, c.identity_column, cc.comments, c.char_used
       FROM all_tab_columns c
       LEFT JOIN all_col_comments cc 
         ON c.owner = cc.owner AND c.table_name = cc.table_name AND c.column_name = cc.column_name
       WHERE c.owner = :owner AND c.table_name = :table_name
       ORDER BY c.column_id`,
      { owner: schemaName, table_name: tableName },
    )

    const columns: ColumnInfo[] = (columnsResult.rows || []).map((col) => {
      // Build type string
      let typeStr = col.DATA_TYPE
      if (col.DATA_TYPE === 'NUMBER') {
        if (col.DATA_PRECISION && col.DATA_SCALE !== null) {
          typeStr = `NUMBER(${col.DATA_PRECISION},${col.DATA_SCALE})`
        } else if (col.DATA_PRECISION) {
          typeStr = `NUMBER(${col.DATA_PRECISION})`
        }
      } else if (col.DATA_TYPE === 'VARCHAR2' || col.DATA_TYPE === 'CHAR') {
        const lengthUnit = col.CHAR_USED === 'C' ? ' CHAR' : ''
        typeStr = `${col.DATA_TYPE}(${col.DATA_LENGTH}${lengthUnit})`
      } else if (col.DATA_TYPE.startsWith('TIMESTAMP')) {
        typeStr = col.DATA_TYPE
      }

      return {
        name: col.COLUMN_NAME,
        description: col.COMMENTS || undefined,
        type: typeStr,
        default: col.DATA_DEFAULT?.trim() || null,
        required: col.NULLABLE === 'N',
        identity: col.IDENTITY_COLUMN === 'YES',
      }
    })

    // Get primary key
    const pkResult = await connection.execute<{ COLUMN_NAME: string }>(
      `SELECT cc.column_name
       FROM all_constraints c
       JOIN all_cons_columns cc ON c.owner = cc.owner AND c.constraint_name = cc.constraint_name
       WHERE c.owner = :owner AND c.table_name = :table_name AND c.constraint_type = 'P'
       ORDER BY cc.position`,
      { owner: schemaName, table_name: tableName },
    )
    const primaryKey = (pkResult.rows || []).map((r) => r.COLUMN_NAME)

    // Get unique constraints
    const ukResult = await connection.execute<{
      CONSTRAINT_NAME: string
      COLUMN_NAME: string
    }>(
      `SELECT c.constraint_name, cc.column_name
       FROM all_constraints c
       JOIN all_cons_columns cc ON c.owner = cc.owner AND c.constraint_name = cc.constraint_name
       WHERE c.owner = :owner AND c.table_name = :table_name AND c.constraint_type = 'U'
       ORDER BY c.constraint_name, cc.position`,
      { owner: schemaName, table_name: tableName },
    )
    const uniqueMap = new Map<string, string[]>()
    for (const row of ukResult.rows || []) {
      if (!uniqueMap.has(row.CONSTRAINT_NAME)) {
        uniqueMap.set(row.CONSTRAINT_NAME, [])
      }
      uniqueMap.get(row.CONSTRAINT_NAME)!.push(row.COLUMN_NAME)
    }
    const unique = Array.from(uniqueMap.values())

    // Get indexes (excluding PK and UK indexes)
    const idxResult = await connection.execute<{
      INDEX_NAME: string
      COLUMN_NAME: string
    }>(
      `SELECT i.index_name, ic.column_name
       FROM all_indexes i
       JOIN all_ind_columns ic ON i.owner = ic.index_owner AND i.index_name = ic.index_name
       WHERE i.owner = :owner AND i.table_name = :table_name
         AND NOT EXISTS (
           SELECT 1 FROM all_constraints c 
           WHERE c.owner = i.owner AND c.index_name = i.index_name
         )
       ORDER BY i.index_name, ic.column_position`,
      { owner: schemaName, table_name: tableName },
    )
    const indexMap = new Map<string, string[]>()
    for (const row of idxResult.rows || []) {
      if (!indexMap.has(row.INDEX_NAME)) {
        indexMap.set(row.INDEX_NAME, [])
      }
      indexMap.get(row.INDEX_NAME)!.push(row.COLUMN_NAME)
    }
    const indexes = Array.from(indexMap.values())

    // Get check constraints
    const ckResult = await connection.execute<{
      CONSTRAINT_NAME: string
      SEARCH_CONDITION: string
    }>(
      `SELECT constraint_name, search_condition
       FROM all_constraints
       WHERE owner = :owner AND table_name = :table_name AND constraint_type = 'C'
         AND generated = 'USER NAME'`,
      { owner: schemaName, table_name: tableName },
    )
    const checks: { column: string; values: string[] }[] = []
    for (const row of ckResult.rows || []) {
      // Parse CHECK constraint condition like: "STATUS" IN ('A', 'D', 'N')
      const match = row.SEARCH_CONDITION?.match(/"?(\w+)"?\s+IN\s*\(([^)]+)\)/i)
      if (match) {
        const column = match[1]
        const values = match[2].split(',').map((v) => v.trim().replace(/^'|'$/g, ''))
        checks.push({ column, values })
      }
    }

    tables.push({
      name: tableName,
      description: tableDescription,
      columns,
      primary_key: primaryKey,
      unique: unique.length > 0 ? unique : undefined,
      indexes: indexes.length > 0 ? indexes : undefined,
      checks: checks.length > 0 ? checks : undefined,
    })
  }

  return tables
}

// ============================================================================
// Diff Calculation
// ============================================================================

function compareSchemas(jsonTables: TableInfo[], dbTables: TableInfo[]): DiffResult {
  const result: DiffResult = {
    newTables: [],
    droppedTables: [],
    modifiedTables: [],
  }

  const jsonTableMap = new Map(jsonTables.map((t) => [t.name.toUpperCase(), t]))
  const dbTableMap = new Map(dbTables.map((t) => [t.name.toUpperCase(), t]))

  // Find new tables
  for (const [name, table] of jsonTableMap) {
    if (!dbTableMap.has(name)) {
      result.newTables.push(table)
    }
  }

  // Find dropped tables
  for (const [name] of dbTableMap) {
    if (!jsonTableMap.has(name)) {
      result.droppedTables.push(name)
    }
  }

  // Find modified tables
  for (const [name, jsonTable] of jsonTableMap) {
    const dbTable = dbTableMap.get(name)
    if (!dbTable) continue

    const jsonColMap = new Map(jsonTable.columns.map((c) => [c.name.toUpperCase(), c]))
    const dbColMap = new Map(dbTable.columns.map((c) => [c.name.toUpperCase(), c]))

    const newColumns: ColumnInfo[] = []
    const droppedColumns: string[] = []
    const modifiedColumns: DiffResult['modifiedTables'][0]['modifiedColumns'] = []

    // Find new columns
    for (const [colName, col] of jsonColMap) {
      if (!dbColMap.has(colName)) {
        newColumns.push(col)
      }
    }

    // Find dropped columns
    for (const [colName] of dbColMap) {
      if (!jsonColMap.has(colName)) {
        droppedColumns.push(colName)
      }
    }

    // Find modified columns
    for (const [colName, jsonCol] of jsonColMap) {
      const dbCol = dbColMap.get(colName)
      if (!dbCol) continue

      const changes: { from: Partial<ColumnInfo>; to: Partial<ColumnInfo> } = {
        from: {},
        to: {},
      }

      // Compare type (normalize for comparison)
      const normalizeType = (t: string) => t.toUpperCase().replace(/\s+/g, ' ')
      if (normalizeType(jsonCol.type) !== normalizeType(dbCol.type)) {
        changes.from.type = dbCol.type
        changes.to.type = jsonCol.type
      }

      // Compare required
      if (jsonCol.required !== dbCol.required) {
        changes.from.required = dbCol.required
        changes.to.required = jsonCol.required
      }

      if (Object.keys(changes.from).length > 0) {
        modifiedColumns.push({ name: colName, ...changes })
      }
    }

    // Compare indexes
    const jsonIndexes = jsonTable.indexes || []
    const dbIndexes = dbTable.indexes || []
    const jsonIndexSet = new Set(jsonIndexes.map((i) => i.join(',').toUpperCase()))
    const dbIndexSet = new Set(dbIndexes.map((i) => i.join(',').toUpperCase()))

    const newIndexes = jsonIndexes.filter((i) => !dbIndexSet.has(i.join(',').toUpperCase()))
    const droppedIndexes = dbIndexes.filter((i) => !jsonIndexSet.has(i.join(',').toUpperCase()))

    // TODO: Compare constraints

    if (
      newColumns.length > 0 ||
      droppedColumns.length > 0 ||
      modifiedColumns.length > 0 ||
      newIndexes.length > 0 ||
      droppedIndexes.length > 0
    ) {
      result.modifiedTables.push({
        name: jsonTable.name,
        newColumns,
        droppedColumns,
        modifiedColumns,
        newIndexes,
        droppedIndexes,
        newConstraints: [],
        droppedConstraints: [],
      })
    }
  }

  return result
}

// ============================================================================
// Migration SQL Generation
// ============================================================================

function generateMigrationSql(schemaName: string, diff: DiffResult): string {
  const lines: string[] = [
    '-- Auto-generated migration script',
    `-- Generated: ${new Date().toISOString()}`,
    '',
    'SET SERVEROUTPUT ON',
    '',
  ]

  // New tables
  if (diff.newTables.length > 0) {
    lines.push('-- ============================================================================')
    lines.push('-- NEW TABLES')
    lines.push('-- ============================================================================')
    lines.push('')

    for (const table of diff.newTables) {
      lines.push(generateIdempotentCreateTable(schemaName, table))
    }
  }

  // Modified tables
  if (diff.modifiedTables.length > 0) {
    lines.push('-- ============================================================================')
    lines.push('-- TABLE MODIFICATIONS')
    lines.push('-- ============================================================================')
    lines.push('')

    for (const mod of diff.modifiedTables) {
      const fullTableName = `${schemaName}.${mod.name}`

      // New columns
      for (const col of mod.newColumns) {
        lines.push(`-- Add column ${col.name} to ${mod.name}`)
        lines.push(`DECLARE`)
        lines.push(`  v_exists NUMBER;`)
        lines.push(`BEGIN`)
        lines.push(
          `  SELECT COUNT(*) INTO v_exists FROM all_tab_columns WHERE owner = '${schemaName}' AND table_name = '${mod.name}' AND column_name = '${col.name}';`,
        )
        lines.push(`  IF v_exists = 0 THEN`)

        let colDef = `${col.name} ${col.type}`
        if (col.default) {
          const isStringType = /^(CHAR|VARCHAR2|CLOB)/i.test(col.type)
          const defaultValue = col.default.trim()
          const needsQuotes =
            isStringType && !defaultValue.includes('(') && !defaultValue.startsWith("'")
          colDef += ` DEFAULT ${needsQuotes ? `''${defaultValue}''` : defaultValue}`
        }
        if (col.required) {
          colDef += ' NOT NULL'
        }

        lines.push(`    EXECUTE IMMEDIATE 'ALTER TABLE ${fullTableName} ADD (${colDef})';`)
        lines.push(`    DBMS_OUTPUT.PUT_LINE('Added column ${col.name} to ${mod.name}');`)
        lines.push(`  ELSE`)
        lines.push(`    DBMS_OUTPUT.PUT_LINE('Column ${col.name} already exists in ${mod.name}');`)
        lines.push(`  END IF;`)
        lines.push(`END;`)
        lines.push(`/`)
        lines.push('')
      }

      // Modified columns
      for (const col of mod.modifiedColumns) {
        lines.push(`-- Modify column ${col.name} in ${mod.name}`)

        const modifications: string[] = []
        if (col.to.type) {
          modifications.push(`${col.name} ${col.to.type}`)
        }
        if (col.to.required !== undefined) {
          if (col.to.required) {
            modifications.push(`${col.name} NOT NULL`)
          } else {
            modifications.push(`${col.name} NULL`)
          }
        }

        if (modifications.length > 0) {
          lines.push(`ALTER TABLE ${fullTableName} MODIFY (${modifications.join(', ')});`)
          lines.push('')
        }
      }

      // New indexes
      for (const idx of mod.newIndexes) {
        const idxName = `idx_${mod.name}_${idx.join('_')}`.toLowerCase()
        lines.push(`-- Add index ${idxName}`)
        lines.push(`DECLARE`)
        lines.push(`  v_exists NUMBER;`)
        lines.push(`BEGIN`)
        lines.push(
          `  SELECT COUNT(*) INTO v_exists FROM all_indexes WHERE owner = '${schemaName}' AND index_name = '${idxName.toUpperCase()}';`,
        )
        lines.push(`  IF v_exists = 0 THEN`)
        lines.push(
          `    EXECUTE IMMEDIATE 'CREATE INDEX ${schemaName}.${idxName} ON ${fullTableName} (${idx.join(', ')})';`,
        )
        lines.push(`    DBMS_OUTPUT.PUT_LINE('Created index ${idxName}');`)
        lines.push(`  ELSE`)
        lines.push(`    DBMS_OUTPUT.PUT_LINE('Index ${idxName} already exists');`)
        lines.push(`  END IF;`)
        lines.push(`END;`)
        lines.push(`/`)
        lines.push('')
      }

      // Dropped indexes (commented out for safety)
      for (const idx of mod.droppedIndexes) {
        const idxName = `idx_${mod.name}_${idx.join('_')}`.toLowerCase()
        lines.push(`-- REVIEW: Drop index ${idxName}?`)
        lines.push(`-- DROP INDEX ${schemaName}.${idxName};`)
        lines.push('')
      }

      // Dropped columns (commented out for safety)
      for (const col of mod.droppedColumns) {
        lines.push(`-- REVIEW: Drop column ${col} from ${mod.name}?`)
        lines.push(`-- ALTER TABLE ${fullTableName} DROP COLUMN ${col};`)
        lines.push('')
      }
    }
  }

  // Dropped tables (commented out for safety)
  if (diff.droppedTables.length > 0) {
    lines.push('-- ============================================================================')
    lines.push('-- DROPPED TABLES (Review before uncommenting!)')
    lines.push('-- ============================================================================')
    lines.push('')

    for (const tableName of diff.droppedTables) {
      lines.push(`-- REVIEW: Drop table ${tableName}?`)
      lines.push(`-- DROP TABLE ${schemaName}.${tableName} CASCADE CONSTRAINTS;`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

function generateIdempotentCreateTable(schemaName: string, table: TableInfo): string {
  const fullTableName = `${schemaName}.${table.name}`
  const lines: string[] = []

  // Build column definitions
  const columnDefs: string[] = []
  for (const col of table.columns) {
    let colDef = `  ${col.name} ${col.type}`
    if (col.default) {
      const isStringType = /^(CHAR|VARCHAR2|CLOB)/i.test(col.type)
      const defaultValue = col.default.trim()
      const needsQuotes =
        isStringType && !defaultValue.includes('(') && !defaultValue.startsWith("'")
      colDef += ` DEFAULT ${needsQuotes ? `''${defaultValue}''` : defaultValue}`
    }
    if (col.required) {
      colDef += ' NOT NULL'
    }
    if (col.identity) {
      colDef += ' GENERATED BY DEFAULT AS IDENTITY'
    }
    columnDefs.push(colDef)
  }

  // Add primary key constraint inline
  if (table.primary_key && table.primary_key.length > 0) {
    const pkName = `pk_${table.name}`.toLowerCase()
    columnDefs.push(`  CONSTRAINT ${pkName} PRIMARY KEY (${table.primary_key.join(', ')})`)
  }

  lines.push(`-- Table: ${table.name}`)
  lines.push(`DECLARE`)
  lines.push(`  v_exists NUMBER;`)
  lines.push(`BEGIN`)
  lines.push(
    `  SELECT COUNT(*) INTO v_exists FROM all_tables WHERE owner = '${schemaName}' AND table_name = '${table.name}';`,
  )
  lines.push(`  IF v_exists = 0 THEN`)
  lines.push(`    EXECUTE IMMEDIATE '`)
  lines.push(`CREATE TABLE ${fullTableName} (`)
  lines.push(columnDefs.join(',\n'))
  lines.push(`)';`)
  lines.push(`    DBMS_OUTPUT.PUT_LINE('Created table ${fullTableName}');`)
  lines.push(`  ELSE`)
  lines.push(`    DBMS_OUTPUT.PUT_LINE('Table ${fullTableName} already exists');`)
  lines.push(`  END IF;`)
  lines.push(`END;`)
  lines.push(`/`)
  lines.push('')

  // Comments
  if (table.description) {
    lines.push(`COMMENT ON TABLE ${fullTableName} IS '${table.description.replace(/'/g, "''")}';`)
  }
  for (const col of table.columns) {
    if (col.description) {
      lines.push(
        `COMMENT ON COLUMN ${fullTableName}.${col.name} IS '${col.description.replace(/'/g, "''")}';`,
      )
    }
  }
  lines.push('')

  // Constraints
  if (table.unique) {
    for (const cols of table.unique) {
      const ukName = `uk_${table.name}_${cols.join('_')}`.toLowerCase()
      lines.push(`DECLARE`)
      lines.push(`  v_exists NUMBER;`)
      lines.push(`BEGIN`)
      lines.push(
        `  SELECT COUNT(*) INTO v_exists FROM all_constraints WHERE owner = '${schemaName}' AND constraint_name = '${ukName.toUpperCase()}';`,
      )
      lines.push(`  IF v_exists = 0 THEN`)
      lines.push(
        `    EXECUTE IMMEDIATE 'ALTER TABLE ${fullTableName} ADD CONSTRAINT ${ukName} UNIQUE (${cols.join(', ')})';`,
      )
      lines.push(`    DBMS_OUTPUT.PUT_LINE('Created constraint ${ukName}');`)
      lines.push(`  END IF;`)
      lines.push(`END;`)
      lines.push(`/`)
      lines.push('')
    }
  }

  if (table.checks) {
    for (const chk of table.checks) {
      const ckName = `ck_${table.name}_${chk.column}`.toLowerCase()
      const values = chk.values.map((v) => `''''${v}''''`).join(', ')
      lines.push(`DECLARE`)
      lines.push(`  v_exists NUMBER;`)
      lines.push(`BEGIN`)
      lines.push(
        `  SELECT COUNT(*) INTO v_exists FROM all_constraints WHERE owner = '${schemaName}' AND constraint_name = '${ckName.toUpperCase()}';`,
      )
      lines.push(`  IF v_exists = 0 THEN`)
      lines.push(
        `    EXECUTE IMMEDIATE 'ALTER TABLE ${fullTableName} ADD CONSTRAINT ${ckName} CHECK (${chk.column} IN (${values}))';`,
      )
      lines.push(`    DBMS_OUTPUT.PUT_LINE('Created constraint ${ckName}');`)
      lines.push(`  END IF;`)
      lines.push(`END;`)
      lines.push(`/`)
      lines.push('')
    }
  }

  // Indexes
  if (table.indexes) {
    for (const cols of table.indexes) {
      const idxName = `idx_${table.name}_${cols.join('_')}`.toLowerCase()
      lines.push(`DECLARE`)
      lines.push(`  v_exists NUMBER;`)
      lines.push(`BEGIN`)
      lines.push(
        `  SELECT COUNT(*) INTO v_exists FROM all_indexes WHERE owner = '${schemaName}' AND index_name = '${idxName.toUpperCase()}';`,
      )
      lines.push(`  IF v_exists = 0 THEN`)
      lines.push(
        `    EXECUTE IMMEDIATE 'CREATE INDEX ${schemaName}.${idxName} ON ${fullTableName} (${cols.join(', ')})';`,
      )
      lines.push(`    DBMS_OUTPUT.PUT_LINE('Created index ${idxName}');`)
      lines.push(`  END IF;`)
      lines.push(`END;`)
      lines.push(`/`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

// ============================================================================
// Main Diff Function
// ============================================================================

async function diffSchema(
  schemaDir: string,
  outputDir: string,
  environment: string,
  offlineMode: boolean,
): Promise<void> {
  const schemaPath = path.isAbsolute(schemaDir) ? schemaDir : path.resolve(process.cwd(), schemaDir)

  if (!existsSync(schemaPath)) {
    throw new Error(`Schema directory not found: ${schemaPath}`)
  }

  const outputPath = path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir)

  mkdirSync(outputPath, { recursive: true })

  // Find JSON files
  const jsonFiles = readdirSync(schemaPath).filter((f) => f.endsWith('.json'))
  if (jsonFiles.length === 0) {
    logger.warn(`No JSON files found in ${schemaPath}`)
    return
  }

  // Load all JSON schemas
  let allJsonTables: TableInfo[] = []
  let schemaName = 'ODBVUE'

  for (const jsonFile of jsonFiles) {
    const jsonPath = path.join(schemaPath, jsonFile)
    const content = readFileSync(jsonPath, 'utf-8')
    const schema: SchemaJson = JSON.parse(content)
    schemaName = schema.schema.toUpperCase()
    allJsonTables = allJsonTables.concat(schema.tables || [])
  }

  let dbTables: TableInfo[] = []

  if (offlineMode) {
    logger.info('Running in offline mode - generating full schema script')
  } else {
    // Connect to database and fetch current schema
    const env = loadEnv(environment)
    const user = env.DB_ADMIN_USERNAME
    const password = env.DB_ADMIN_PASSWORD
    const connectString = env.DB_CONNECT_STRING || 'myatp_high'

    if (!user || !password) {
      logger.warn('No database credentials found. Running in offline mode.')
    } else {
      const walletPath = getWalletPath(env, environment)
      const walletPassword = env.DB_WALLET_PASSWORD?.trim()

      logger.info(`Connecting to ${connectString} as ${user}...`)

      const originalTNS_ADMIN = process.env.TNS_ADMIN
      process.env.TNS_ADMIN = walletPath

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

        const connection = await oracledb.getConnection(connectionConfig)
        logger.success('Connected to database')

        try {
          dbTables = await fetchDbSchema(connection, schemaName)
          logger.info(`Found ${dbTables.length} existing table(s) in database`)
        } finally {
          await connection.close()
        }
      } catch (error) {
        logger.warn(
          `Could not connect to database: ${error instanceof Error ? error.message : String(error)}`,
        )
        logger.info('Falling back to offline mode')
      } finally {
        if (originalTNS_ADMIN === undefined) {
          delete process.env.TNS_ADMIN
        } else {
          process.env.TNS_ADMIN = originalTNS_ADMIN
        }
      }
    }
  }

  // Compare schemas
  const diff = compareSchemas(allJsonTables, dbTables)

  // Report diff
  const hasChanges =
    diff.newTables.length > 0 || diff.droppedTables.length > 0 || diff.modifiedTables.length > 0

  if (!hasChanges) {
    logger.success('No schema changes detected')
    return
  }

  logger.info('Schema differences found:')
  if (diff.newTables.length > 0) {
    logger.info(`  New tables: ${diff.newTables.map((t) => t.name).join(', ')}`)
  }
  if (diff.droppedTables.length > 0) {
    logger.warn(`  Dropped tables: ${diff.droppedTables.join(', ')}`)
  }
  for (const mod of diff.modifiedTables) {
    const changes: string[] = []
    if (mod.newColumns.length > 0) {
      changes.push(`+${mod.newColumns.length} columns`)
    }
    if (mod.droppedColumns.length > 0) {
      changes.push(`-${mod.droppedColumns.length} columns`)
    }
    if (mod.modifiedColumns.length > 0) {
      changes.push(`~${mod.modifiedColumns.length} columns modified`)
    }
    if (mod.newIndexes.length > 0) {
      changes.push(`+${mod.newIndexes.length} indexes`)
    }
    logger.info(`  Modified: ${mod.name} (${changes.join(', ')})`)
  }

  // Generate migration SQL
  const migrationSql = generateMigrationSql(schemaName, diff)
  const migrationPath = path.join(outputPath, 'next.sql')
  writeFileSync(migrationPath, migrationSql)

  logger.success(`Generated migration script: ${path.relative(rootDir, migrationPath)}`)
}

// ============================================================================
// Command Registration
// ============================================================================

export const registerDbDiffCommand = (program: Command) => {
  program
    .command('db-diff')
    .alias('dd')
    .description('Compare JSON schema with database and generate migration script')
    .argument('[schemaDir]', 'Directory containing JSON schema files', 'db/schema')
    .argument('[outputDir]', 'Output directory for migration script', 'db/releases/next')
    .option('-e, --environment <env>', 'Environment name (default: from config.yaml)')
    .option('--offline', 'Run in offline mode (generate full schema, no DB connection)')
    .action(
      async (
        schemaDir: string,
        outputDir: string,
        options: { environment?: string; offline?: boolean },
      ) => {
        const environment = options.environment || getDefaultEnvironment()
        try {
          await diffSchema(schemaDir, outputDir, environment, options.offline || false)
        } catch (error) {
          logger.error(`Diff failed: ${error instanceof Error ? error.message : String(error)}`)
          process.exit(1)
        }
      },
    )
}
