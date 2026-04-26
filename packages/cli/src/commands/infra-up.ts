import { Command } from 'commander'

import { logger } from '../shared/logger.js'

import { runInfraUpOracleAdb } from '../app/infra-up-oracle-adb.js'

export const registerInfraUpCommand = (program: Command) => {
  program
    .command('infra-up')
    .alias('iu')
    .description('Infrastructure startup')
    .action(async () => {
      logger.info('Starting infrastructure...')

      await runInfraUpOracleAdb()
      logger.info('Infrastructure is ready!')
    })
}
