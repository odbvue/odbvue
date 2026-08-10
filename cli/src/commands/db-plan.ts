import { Command } from 'commander'

import { runDbPlan } from '../app/db-plan.js'

export const registerDbPlanCommand = (program: Command) => {
  program
    .command('db-plan')
    .alias('dp')
    .description('Preview migration changes to base, latest, or a tag')
    .argument('<target>', 'base, latest, or migration tag')
    .action(async (target: string) => {
      await runDbPlan(target)
    })
}
