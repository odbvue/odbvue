import { Command } from 'commander'

import { runStatus } from '../app/status.js'

export const registerStatusCommand = (program: Command) => {
  program
    .command('status')
    .description('Check the status of the project')
    .action(async () => {
      await runStatus()
    })
}
