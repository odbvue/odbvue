import { Command } from 'commander'

import { runDbUp } from '../app/db-up.js'

export const registerDbUpCommand = (program: Command) => {
  program
    .command('db-up')
    .alias('du')
    .description('Load secrets and generate database migration SQL files')
    .action(async () => {
      await runDbUp()
    })
}
