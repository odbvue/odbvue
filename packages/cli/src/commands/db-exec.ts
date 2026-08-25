import { Command } from 'commander'

import { runDbExec } from '../app/db-exec.js'

export const registerDbExecCommand = (program: Command) => {
  program
    .command('db-exec <statement>')
    .alias('de')
    .description('Execute a SQL statement in the database')
    .action(async (statement: string) => {
      await runDbExec(statement, false, true)
    })
}
