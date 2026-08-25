import path from 'path'
import fs from 'fs'

import { dbDir } from '../shared/dirs.js'

import { logger } from '../shared/logger.js'
import { version } from '../shared/version.js'

const nextVersionStr = version
  .split('.')
  .map((v: string) => Number(v))
  .map((v: number, i: number) => (i === 2 ? v + 1 : v))
  .join('.')

export const runDbScaffold = async (name?: string): Promise<void> => {
  const ts = new Date()
    .toISOString()
    .replace(/[-T:.]/g, '')
    .substring(0, 14)
  const slug = name?.trim().toLowerCase()

  if (name && (!slug || !/^[a-z0-9-]+$/.test(slug))) {
    throw new Error('Migration name must contain only Latin letters, numbers, and hyphens')
  }

  const namePart = slug ? `${ts}-${slug}` : ts
  const migrationId = namePart.replaceAll('-', '_')

  if (!/^[a-z0-9_]+$/.test(migrationId)) {
    throw new Error(`Generated migration ID is invalid: ${migrationId}`)
  }

  const filePath = path.join(dbDir, 'src', 'migrations', `${namePart}.ts`)

  if (fs.existsSync(filePath)) {
    throw new Error(`Migration file already exists: ${filePath}`)
  }

  const template = `import { defineMigration } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('${migrationId}', {
  schema: schemaName,
  tag: '${nextVersionStr}',
})
`
  fs.writeFileSync(filePath, template)
  logger.muted(`Migration scaffolded to ${filePath}`)
  logger.lf()
}
