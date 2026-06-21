import { Command } from 'commander'

import { runDbDown } from '../app/db-down.js'

export const registerDbDownCommand = (program: Command) => {
  program
    .command('db-down')
    .alias('dd')
    .description('Load secrets and generate database migration SQL files')
    .action(async () => {
      await runDbDown()
    })
}
