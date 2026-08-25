import { Command } from 'commander'

import { runDbUp } from '../app/db-up.js'

export const registerDbUpCommand = (program: Command) => {
  program
    .command('db-up')
    .alias('du')
    .description('Apply one migration or migrate up to base, latest, or a tag')
    .argument('[target]', 'base, latest, or migration tag')
    .action(async (target?: string) => {
      await runDbUp(target)
    })
}
