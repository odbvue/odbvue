import path from 'path'

import { SecretsStore } from '../adapters/secrets-store.js'

import { dbDir } from '../shared/dirs.js'
import { logger } from '../shared/logger.js'

import { runDbExec } from './db-exec.js'

import { generateMigrationsFromCompiledModules } from '@odbvue/odb'

const schemaExists = async (schemaUsername: string): Promise<boolean> => {
  const result = await runDbExec(
    `SELECT 1 FROM all_users WHERE username = '${schemaUsername.toUpperCase()}'`,
    true,
    false,
  )
  const rows = (result?.[0]?.rows as Array<Record<string, unknown>>) ?? []
  return rows.length > 0
}

const getAppliedMigrations = async (schemaUsername: string): Promise<Set<string>> => {
  if (!(await schemaExists(schemaUsername))) {
    return new Set()
  }

  const result = await runDbExec(
    `SELECT name FROM ${schemaUsername}.app_migrations ORDER BY name`,
    true,
    false,
  )
  const rows = (result?.[0]?.rows as Array<Record<string, unknown>>) ?? []
  return new Set(rows.map((r) => String(r['NAME'])))
}

export const runDbMigrate = async (direction: 'up' | 'down'): Promise<void> => {
  logger.info(`Applying DB migrations (${direction})...`)

  const sourceDir = path.join(dbDir, 'dist', 'migrations')
  const destDir = path.join(dbDir, 'dist', 'sql')

  const secrets = new SecretsStore()
  secrets.load()
  const schemaUsername = secrets.get('ODBVUE_ADB_SCHEMA_USERNAME')
  if (!schemaUsername) {
    logger.error('Schema username not found in secrets')
    return
  }

  const allEntries = await generateMigrationsFromCompiledModules(sourceDir, destDir)

  const entries = allEntries
    .filter((e) => e.endsWith(`_${direction}.sql`))
    .toSorted(direction === 'down' ? (a, b) => b.localeCompare(a) : undefined)

  if (entries.length === 0) {
    logger.info('No migrations found')
    return
  }

  const applied = await getAppliedMigrations(schemaUsername)

  let ran = 0
  for (const entry of entries) {
    const migrationName = path.basename(entry).replace(`_${direction}.sql`, '')

    if (direction === 'up' && applied.has(migrationName)) {
      logger.muted(`  Skipping ${migrationName} (already applied)`)
      continue
    }
    if (direction === 'down' && !applied.has(migrationName)) {
      logger.muted(`  Skipping ${migrationName} (not applied)`)
      continue
    }

    logger.info(`  Running ${migrationName}...`)

    await runDbExec(entry, false, true)

    if (direction === 'up') {
      await runDbExec(
        `INSERT INTO ${schemaUsername}.app_migrations (name) VALUES ('${migrationName}')`,
        true,
        true,
      )
    } else {
      if (await schemaExists(schemaUsername)) {
        await runDbExec(
          `DELETE FROM ${schemaUsername}.app_migrations WHERE name = '${migrationName}'`,
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
    logger.success(`  ${migrationName} done.`)
  }

  if (ran === 0) {
    logger.info('No new migrations to apply')
  } else {
    logger.success(`${ran} migration(s) applied successfully.`)
  }
  logger.lf()
}
