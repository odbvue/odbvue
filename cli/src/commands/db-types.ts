import { Command } from 'commander'

import { runDbTypes } from '../app/db-types.js'

export const registerDbTypesCommand = (program: Command) => {
  program
    .command('db-types')
    .alias('dt')
    .description('Generate TypeScript types for ORDS services from migrations')
    .option('-o, --output <path>', 'Output directory for generated ORDS module clients')
    .action(async (options: { output?: string }) => {
      await runDbTypes(options.output)
    })
}
