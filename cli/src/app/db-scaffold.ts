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
  const namePart = (name ? `${ts}-${name}` : `${ts}`)
    .replaceAll(' ', '-')
    .replaceAll('_', '-')
    .toLowerCase()
  const filePath = path.join(dbDir, 'src', 'migrations', `${namePart}.ts`)
  const template = `import { defineMigration } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

export const migration = defineMigration('${namePart.replaceAll('-', '_')}', {
  schema: schemaName,
  version: '${nextVersionStr}',
})
`
  fs.writeFileSync(filePath, template)
  logger.muted(`Migration scaffolded to ${filePath}`)
  logger.lf()
}
