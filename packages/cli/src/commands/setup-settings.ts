import { Command } from 'commander'

import { runSetupSettings } from '../app/setup-settings.js'
import { logger } from '../shared/logger.js'

export const registerSetupSettingsCommand = (program: Command) => {
  program
    .command('setup-settings')
    .alias('ss')
    .description(
      'Configure SMTP, JWT, and application URL settings and update the database network ACL',
    )
    .argument(
      '[file]',
      'JSON file with SMTP, JWT, and application URL settings (case-insensitive keys)',
    )
    .action(async (file?: string) => {
      try {
        await runSetupSettings(file)
      } catch (error) {
        logger.fatal(error)
      }
    })
}
