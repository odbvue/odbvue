import { Command } from 'commander'

import { runSetupSettings } from '../app/setup-settings.js'
import { logger } from '../shared/logger.js'

export const registerSetupSettingsCommand = (program: Command) => {
  program
    .command('setup-settings')
    .alias('ss')
    .description('Configure SMTP settings and update the database network ACL')
    .action(async () => {
      try {
        await runSetupSettings()
      } catch (error) {
        logger.fatal(error)
      }
    })
}
