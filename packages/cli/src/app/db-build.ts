import { spawnSync } from 'child_process'
import { rmSync } from 'fs'
import path from 'path'

import { dbDir, rootDir } from '../shared/dirs.js'
import { logger } from '../shared/logger.js'

export const buildDbProject = (): void => {
  logger.info('Building DB project...')

  rmSync(path.join(dbDir, 'dist', 'migrations'), { recursive: true, force: true })
  rmSync(path.join(dbDir, 'dist', 'sql'), { recursive: true, force: true })

  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(pnpm, ['--dir', dbDir, 'build'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) {
    throw new Error(`Failed to start DB project build: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`DB project build failed with exit code ${result.status ?? 'unknown'}`)
  }
}
