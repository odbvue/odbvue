import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import {
  generateApplicationsOpenApi,
  type MigrationBuilder,
  type OdbApplication,
} from '@odbvue/odb'

import { dbDir } from '../shared/dirs.js'
import { logger } from '../shared/logger.js'

const OUTPUT_PATH = path.join(dbDir, 'dist', 'openapi.json')

export const writeDeployedOpenApi = async (appliedIds: readonly string[]): Promise<void> => {
  const applied = new Set(appliedIds)
  const migrationsDir = path.join(dbDir, 'dist', 'migrations')
  const applications: OdbApplication[] = []

  for (const entry of fs
    .readdirSync(migrationsDir)
    .filter((value) => value.endsWith('.js'))
    .toSorted()) {
    const modulePath = path.join(migrationsDir, entry)
    const mod = await import(pathToFileURL(modulePath).href)
    const migration = mod.migration as MigrationBuilder | undefined
    if (migration && applied.has(migration.compile().name)) {
      applications.push(...migration.applications())
    }
  }

  const manifest = generateApplicationsOpenApi(applications, { title: 'OdbVue API' })
  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  logger.info(`Wrote deployed OpenAPI manifest to ${OUTPUT_PATH}`)
}

export const writeEmptyDeployedOpenApi = async (): Promise<void> => {
  await writeDeployedOpenApi([])
}
