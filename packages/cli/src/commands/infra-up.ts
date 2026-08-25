import { Command } from 'commander'

import { runInfraUpPodman } from '../app/infra-up-podman.js'
import { runInfraUpOci } from '../app/infra-up-oci.js'

export const registerInfraUpCommand = (program: Command) => {
  program
    .command('infra-up')
    .alias('iu')
    .description('Infrastructure startup')
    .action(async () => {
      await runInfraUpPodman()
      await runInfraUpOci()
    })
}
