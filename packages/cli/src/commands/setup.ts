import { Command, InvalidArgumentError } from 'commander'

import { runSetupEnvironment } from '../app/setup-environment.js'
import { runSetupPlatforms } from '../app/setup-platforms.js'
import { runSetupOracleAdb } from '../app/setup-resources-oracle-adb.js'
import { runInfraUp } from '../app/infra-up.js'
import { runDbUp } from '../app/db-up.js'
import { runSetupSettings } from '../app/setup-settings.js'
import { logger } from '../shared/logger.js'

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description(
      'Configure the project, start infrastructure, and deploy the latest database migrations',
    )
    .argument('[section]', 'Optional section: settings', (value) => {
      if (value !== 'settings')
        throw new InvalidArgumentError('Only the settings section is supported')
      return value
    })
    .argument('[file]', 'JSON settings file, for the settings section')
    .action(async (section?: string, file?: string) => {
      if (section === 'settings') {
        try {
          await runSetupSettings(file)
        } catch (error) {
          logger.fatal(error)
        }
        return
      }
      await runSetupEnvironment()
      await runSetupPlatforms()

      await runSetupOracleAdb()
      await runInfraUp()
      await runDbUp('latest')
    })
}
