import { Command } from 'commander'

import { runDbScaffold } from '../app/db-scaffold.js'
import { logger } from '../shared/logger.js'

export const registerDbScaffoldCommand = (program: Command) => {
  program
    .command('db-scaffold')
    .alias('ds')
    .description('Scaffolds a new db migration script')
    .argument('[name]', 'Script name')
    .action(async (name) => {
      try {
        await runDbScaffold(name)
      } catch (error) {
        logger.fatal(error)
      }
    })
}
