import { Command } from 'commander'

import { runSetupEnvironment } from './setup-environment.js'
import { runSetupPlatforms } from './setup-platforms.js'
import { runSetupAdb } from './setup-adb.js'

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description('Initial project setup')
    .action(async () => {
      await runSetupEnvironment()
      await runSetupPlatforms()

      await runSetupAdb()
    })
}
