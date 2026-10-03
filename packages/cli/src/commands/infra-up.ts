import { Command } from 'commander'

import { runInfraUp } from '../app/infra-up.js'

export const registerInfraUpCommand = (program: Command) => {
  program
    .command('infra-up')
    .alias('iu')
    .description('Infrastructure startup')
    .action(async () => {
      await runInfraUp()
    })
}
