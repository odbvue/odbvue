import { Command } from 'commander'

import { runInfraStatus } from '../app/infra-status.js'

export const registerInfraStatusCommand = (program: Command) => {
  program
    .command('infra-status')
    .alias('is')
    .description('Check the status of the infrastructure')
    .action(async () => {
      await runInfraStatus()
    })
}
