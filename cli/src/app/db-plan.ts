import { planMigrations } from '@odbvue/odb'

import { logger } from '../shared/logger.js'

import { loadDbMigrationState } from './db-migrate.js'

export const runDbPlan = async (target: string): Promise<void> => {
  const state = await loadDbMigrationState()
  if (!state) return

  const plan = planMigrations(state.migrations, state.appliedIds, { target })

  logger.msg(`Current:   ${plan.currentId ?? 'base'}`)
  logger.msg(`Target:    ${target}${plan.targetId ? ` (${plan.targetId})` : ''}`)
  logger.msg(`Direction: ${plan.direction ?? 'none'}`)

  if (plan.steps.length === 0) {
    logger.info('Migration target already reached')
  } else {
    logger.lf()
    for (const step of plan.steps) {
      logger.msg(
        `${step.direction.toUpperCase().padEnd(4)} ${step.id}${step.tag ? ` [${step.tag}]` : ''}`,
      )
    }
  }
  logger.lf()
}
