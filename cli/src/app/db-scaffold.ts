import path from 'path'
import fs from 'fs'

import { dbDir } from '../shared/dirs.js'

import { logger } from '../shared/logger.js'

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

export const migration = defineMigration('${namePart.replaceAll('-', '_')}')
  .up(() => {
    return ''
  })
  .down(() => {
    return ''
  })
`
  fs.writeFileSync(filePath, template)
  logger.muted(`Migration scaffolded to ${filePath}`)
  logger.lf()
}
