import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import { generateOrdsClient, type MigrationBuilder, type OrdsEndpoint } from '@odbvue/odb'

import { SecretsStore } from '../adapters/secrets-store.js'

import { dbDir, webDir } from '../shared/dirs.js'
import { logger } from '../shared/logger.js'

const DEFAULT_OUTPUT = path.join(webDir, 'src', 'services', 'ords.generated.ts')

/**
 * Generate typed ORDS service contracts from the compiled migration modules.
 * Definition-first: reads `.migration.ordsEndpoints()` from each compiled
 * migration in `apps/db/dist/migrations` — no database connection required.
 */
export const runDbTypes = async (outputPath: string = DEFAULT_OUTPUT): Promise<void> => {
  logger.info('Generating ORDS service types...')

  // Migration modules read schema credentials from the environment at import time.
  new SecretsStore().load()

  const migrationsDir = path.join(dbDir, 'dist', 'migrations')
  if (!fs.existsSync(migrationsDir)) {
    logger.error(`Compiled migrations not found at ${migrationsDir}. Build apps/db first.`)
    return
  }

  const entries = fs
    .readdirSync(migrationsDir)
    .filter((e) => e.endsWith('.js'))
    .toSorted()

  const endpoints: OrdsEndpoint[] = []
  for (const entry of entries) {
    const modulePath = path.join(migrationsDir, entry)
    const mod = await import(pathToFileURL(modulePath).href)
    const migration = mod.migration as MigrationBuilder | undefined
    if (typeof migration?.ordsEndpoints === 'function') {
      endpoints.push(...migration.ordsEndpoints())
    }
  }

  if (endpoints.length === 0) {
    logger.warn('No ORDS endpoints found in migrations')
  }

  const source = generateOrdsClient(endpoints)
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, source, 'utf8')

  logger.info(`Wrote ${endpoints.length} ORDS operation(s) to ${outputPath}`)
  logger.lf()
}
