import { Command } from 'commander'

import { runDbDown } from '../app/db-down.js'

export const registerDbDownCommand = (program: Command) => {
  program
    .command('db-down')
    .alias('dd')
    .description('Roll back one migration or migrate down to base, latest, or a tag')
    .argument('[target]', 'base, latest, or migration tag')
    .action(async (target?: string) => {
      await runDbDown(target)
    })
}
