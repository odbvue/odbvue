import { Command } from 'commander'

import { runSetupEnvironment } from '../app/setup-environment.js'
import { runSetupPlatforms } from '../app/setup-platforms.js'
import { runSetupOracleAdb } from '../app/setup-resources-oracle-adb.js'

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description('Initial project setup')
    .action(async () => {
      await runSetupEnvironment()
      await runSetupPlatforms()

      await runSetupOracleAdb()
    })
}
