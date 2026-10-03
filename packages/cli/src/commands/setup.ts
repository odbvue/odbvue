import { Command } from 'commander'

import { runSetupEnvironment } from '../app/setup-environment.js'
import { runSetupPlatforms } from '../app/setup-platforms.js'
import { runSetupOracleAdb } from '../app/setup-resources-oracle-adb.js'
import { runInfraUp } from '../app/infra-up.js'
import { runDbUp } from '../app/db-up.js'

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description(
      'Configure the project, start infrastructure, and deploy the latest database migrations',
    )
    .action(async () => {
      await runSetupEnvironment()
      await runSetupPlatforms()

      await runSetupOracleAdb()
      await runInfraUp()
      await runDbUp('latest')
    })
}
