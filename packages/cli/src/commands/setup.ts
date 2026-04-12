import { Command } from 'commander'
import { logger } from '../utils/logger.js'

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description('Initial project setup')
    .action(async () => {
      logger.info('Setup...')
      logger.lf()
    })
}
