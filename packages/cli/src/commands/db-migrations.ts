import { Command } from 'commander'

import { runDbMigrations } from '../app/db-migrations.js'

export const registerDbMigrationsCommand = (program: Command) => {
  program
    .command('db-migrations')
    .alias('dm')
    .description('List local migrations and their applied state')
    .action(async () => {
      await runDbMigrations()
    })
}
