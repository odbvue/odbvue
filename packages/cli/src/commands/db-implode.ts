import { Command } from 'commander'

import { runDbImplode } from '../app/db-implode.js'

export const registerDbImplodeCommand = (program: Command) => {
  program
    .command('db-implode')
    .alias('di')
    .description('Remove the configured database schema and all ORDS metadata')
    .argument('[schema]', 'configured schema name')
    .option('-y, --yes', 'skip typed schema confirmation')
    .action(async (schema: string | undefined, options: { yes?: boolean }) => {
      await runDbImplode({ schema, yes: options.yes })
    })
}
