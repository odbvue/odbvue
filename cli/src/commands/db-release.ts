import chalk from 'chalk'
import { logger } from '../index.js'

export async function handleDbRelease(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  logger.info('db-release command is under development')
  logger.log('')
  logger.log(chalk.cyan('Description:'))
  logger.log(chalk.gray('  Tags version and manages release bundles'))
  logger.log(chalk.gray('  Source: ./db/migrations/**/*.sql'))
  logger.log(chalk.gray('  Output: ./db/releases/<version>/'))
  logger.log('')
  logger.log(chalk.cyan('Configuration:'))
  logger.log(chalk.gray(`  Project: ${defaultProject}`))
  logger.log(chalk.gray(`  Environment: ${defaultEnvironment}`))
  if (argv.length > 0) {
    logger.log(chalk.gray(`  Version: ${argv[0]}`))
    if (argv.length > 1) {
      logger.log(chalk.gray(`  Options: ${argv.slice(1).join(', ')}`))
    }
  }
  logger.log('')
  logger.log(chalk.cyan('Usage:'))
  logger.log(chalk.gray('  $ ov db-release <version> [--changelog]'))
  logger.log('')

  process.exit(1)
}
