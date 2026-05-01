import { Command } from 'commander'

import { runInfraDownPodman } from '../app/infra-down-podman.js'

export const registerInfraDownCommand = (program: Command) => {
  program
    .command('infra-down')
    .alias('id')
    .description('Infrastructure shutdown')
    .action(async () => {
      await runInfraDownPodman()
    })
}
