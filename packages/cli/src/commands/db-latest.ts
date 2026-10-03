import { Command } from 'commander'

import { runDbUp } from '../app/db-up.js'

export const registerDbLatestCommand = (program: Command) => {
  program
    .command('db-latest')
    .alias('dl')
    .description('Apply all pending database migrations')
    .action(async () => {
      await runDbUp('latest')
    })
}
