import path from 'path'
import { pathToFileURL } from 'url'

import { SecretsStore } from '../adapters/secrets-store.js'

import { dbDir } from '../shared/dirs.js'
import { logger } from '../shared/logger.js'

import { buildDbProject } from './db-build.js'
import { runDbExec } from './db-exec.js'

import {
  generateMigrationsFromCompiledModules,
  migrationMetadataSql,
  ODB_MIGRATIONS_TABLE,
  ODB_MIGRATION_OBJECTS_TABLE,
  planMigrations,
  type GeneratedMigration,
  type MigrationDirection,
} from '@odbvue/odb'
import { splitSqlStatements } from '@odbvue/odb-oracledb'

const normalizeSchemaName = (schema: string): string => {
  const normalized = schema.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(normalized)) {
    throw new Error(`Invalid Oracle schema name "${schema}"`)
  }
  return normalized
}

const schemaExists = async (schemaUsername: string): Promise<boolean> => {
  const result = await runDbExec(
    `SELECT 1 FROM all_users WHERE username = '${schemaUsername.toUpperCase()}'`,
    true,
    false,
  )
  const rows = (result?.[0]?.rows as Array<Record<string, unknown>>) ?? []
  return rows.length > 0
}

const tableExists = async (schemaUsername: string, tableName: string): Promise<boolean> => {
  const result = await runDbExec(
    `SELECT 1 FROM all_tables WHERE owner = '${schemaUsername.toUpperCase()}' AND table_name = '${tableName.toUpperCase()}'`,
    true,
    false,
  )
  const rows = (result?.[0]?.rows as Array<Record<string, unknown>>) ?? []
  return rows.length > 0
}

const executeSql = async (sql: string): Promise<void> => {
  for (const statement of splitSqlStatements(sql)) {
    await runDbExec(statement, true, true)
  }
}

const ensureSchema = async (schemaUsername: string): Promise<void> => {
  if (await schemaExists(schemaUsername)) return

  const schemaModulePath = path.join(dbDir, 'dist', 'schema.js')
  const mod = (await import(pathToFileURL(schemaModulePath).href)) as {
    schema?: { username: string; toSQLUp(): string }
  }
  if (!mod.schema) {
    throw new Error('Database project must export schema from src/schema.ts')
  }
  if (mod.schema.username.toUpperCase() !== schemaUsername.toUpperCase()) {
    throw new Error(
      `Exported schema ${mod.schema.username} does not match configured schema ${schemaUsername}`,
    )
  }

  logger.info(`Creating schema ${schemaUsername}...`)
  await executeSql(mod.schema.toSQLUp())
}

const ensureMetadataTable = async (
  schemaUsername: string,
  tableName: string,
  createSql: string,
): Promise<void> => {
  if (await tableExists(schemaUsername, tableName)) return

  logger.info(`Creating ${tableName}...`)
  await executeSql(createSql)
}

const ensureMigrationInfrastructure = async (schemaUsername: string): Promise<void> => {
  await ensureSchema(schemaUsername)
  const [migrationsSql, objectsSql] = migrationMetadataSql(schemaUsername)
  await ensureMetadataTable(schemaUsername, ODB_MIGRATIONS_TABLE, migrationsSql)
  await ensureMetadataTable(schemaUsername, ODB_MIGRATION_OBJECTS_TABLE, objectsSql)
}

const getAppliedMigrations = async (schemaUsername: string): Promise<string[]> => {
  if (!(await schemaExists(schemaUsername))) {
    return []
  }

  const result = await runDbExec(
    `SELECT migration_name FROM ${schemaUsername}.${ODB_MIGRATIONS_TABLE} ORDER BY migration_name`,
    true,
    false,
  )
  const rows = (result?.[0]?.rows as Array<Record<string, unknown>>) ?? []
  return rows.map((r) => String(r['MIGRATION_NAME']))
}

export type DbMigrationState = {
  migrations: GeneratedMigration[]
  appliedIds: string[]
  schemaUsername: string
}

export type LoadDbMigrationStateOptions = {
  ensureInfrastructure?: boolean
}

export const loadDbMigrationState = async (
  options: LoadDbMigrationStateOptions = {},
): Promise<DbMigrationState | null> => {
  buildDbProject()

  const sourceDir = path.join(dbDir, 'dist', 'migrations')
  const destDir = path.join(dbDir, 'dist', 'sql')

  const secrets = new SecretsStore()
  secrets.load()
  const configuredSchema = secrets.get('ODBVUE_ADB_SCHEMA_USERNAME')
  if (!configuredSchema) {
    logger.error('Schema username not found in secrets')
    return null
  }
  const schemaUsername = normalizeSchemaName(configuredSchema)

  const migrations = await generateMigrationsFromCompiledModules(sourceDir, destDir)
  if (options.ensureInfrastructure === false) {
    if (!(await schemaExists(schemaUsername))) {
      logger.warn(`Schema ${schemaUsername} does not exist`)
      return null
    }
  } else {
    await ensureMigrationInfrastructure(schemaUsername)
  }
  const appliedIds = await getAppliedMigrations(schemaUsername)

  return { migrations, appliedIds, schemaUsername }
}

export const runDbMigrate = async (
  direction: MigrationDirection,
  target?: string,
): Promise<void> => {
  logger.info(`Applying DB migrations (${direction})...`)

  const state = await loadDbMigrationState()
  if (!state) return

  const { migrations, appliedIds, schemaUsername } = state

  if (migrations.length === 0) {
    logger.info('No migrations found')
    return
  }

  const plan = planMigrations(migrations, appliedIds, { direction, target })
  const migrationsById = new Map(migrations.map((migration) => [migration.id, migration]))

  let ran = 0
  for (const step of plan.steps) {
    const migration = migrationsById.get(step.id)
    if (!migration) throw new Error(`Migration ${step.id} is missing from the generated catalog`)
    const migrationPath = step.direction === 'up' ? migration.upPath : migration.downPath

    logger.info(`  Running ${step.id}...`)

    await runDbExec(migrationPath, false, true)

    if (step.direction === 'up') {
      await runDbExec(
        `INSERT INTO ${schemaUsername}.${ODB_MIGRATIONS_TABLE} (migration_name) VALUES ('${step.id}')`,
        true,
        true,
      )
    } else {
      if (await schemaExists(schemaUsername)) {
        await runDbExec(
          `DELETE FROM ${schemaUsername}.${ODB_MIGRATIONS_TABLE} WHERE migration_name = '${step.id}'`,
          true,
          false,
        )
      } else {
        logger.muted(
          `  Schema ${schemaUsername} no longer exists; skipping migration metadata cleanup`,
        )
      }
    }

    ran++
    logger.success(`  ${step.id} done.`)
  }

  if (ran === 0) {
    logger.info('Migration target already reached')
  } else {
    logger.success(`${ran} migration(s) completed successfully.`)
  }
  logger.lf()
}
