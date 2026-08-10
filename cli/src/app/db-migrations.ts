import { planMigrations } from '@odbvue/odb'

import { logger } from '../shared/logger.js'

import { loadDbMigrationState } from './db-migrate.js'

export const runDbMigrations = async (): Promise<void> => {
  const state = await loadDbMigrationState({ ensureInfrastructure: false })
  if (!state) return

  planMigrations(state.migrations, state.appliedIds, { direction: 'up' })

  const applied = new Set(state.appliedIds)
  const currentId = state.appliedIds.at(-1)

  if (state.migrations.length === 0) {
    logger.info('No migrations found')
    return
  }

  for (const migration of state.migrations) {
    const status = applied.has(migration.id) ? 'applied' : 'pending'
    const current = migration.id === currentId ? ' current' : ''
    const tag = migration.tag ? ` [${migration.tag}]` : ''
    logger.msg(`${status.padEnd(7)} ${migration.id}${tag}${current}`)
  }
  logger.lf()
}
