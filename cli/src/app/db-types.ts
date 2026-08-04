import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import { generateOrdsClientModules, type MigrationBuilder, type OrdsEndpoint } from '@odbvue/odb'

import { SecretsStore } from '../adapters/secrets-store.js'

import { dbDir, webDir } from '../shared/dirs.js'
import { logger } from '../shared/logger.js'

const DEFAULT_OUTPUT_DIRECTORY = path.join(webDir, 'src', 'services', 'generated')
const LEGACY_OUTPUT = path.join(webDir, 'src', 'services', 'ords.generated.ts')

/**
 * Generate typed ORDS service contracts from the compiled migration modules.
 * Definition-first: reads `.migration.ordsEndpoints()` from each compiled
 * migration in `apps/db/dist/migrations` — no database connection required.
 */
export const runDbTypes = async (
  outputDirectory: string = DEFAULT_OUTPUT_DIRECTORY,
): Promise<void> => {
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

  const generated = generateOrdsClientModules(endpoints)
  fs.mkdirSync(outputDirectory, { recursive: true })
  for (const entry of fs.readdirSync(outputDirectory)) {
    if (entry.endsWith('.ts')) {
      fs.rmSync(path.join(outputDirectory, entry), { force: true })
    }
  }
  for (const [fileName, source] of generated.files) {
    fs.writeFileSync(path.join(outputDirectory, fileName), source, 'utf8')
  }
  fs.writeFileSync(path.join(outputDirectory, 'index.ts'), generated.index, 'utf8')

  if (path.resolve(outputDirectory) === path.resolve(DEFAULT_OUTPUT_DIRECTORY)) {
    fs.rmSync(LEGACY_OUTPUT, { force: true })
  }

  logger.info(
    `Wrote ${endpoints.length} ORDS operation(s) across ${generated.files.size} module(s) to ${outputDirectory}`,
  )
  logger.lf()
}
