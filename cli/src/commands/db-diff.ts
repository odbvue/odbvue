import chalk from 'chalk'
import { logger } from '../index.js'

export async function handleDbDiff(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  logger.info('db-diff command is under development')
  logger.log('')
  logger.log(chalk.cyan('Description:'))
  logger.log(chalk.gray('  Compares JSON schema against live database'))
  logger.log(chalk.gray('  Generates migration SQL for differences'))
  logger.log('')
  logger.log(chalk.cyan('Configuration:'))
  logger.log(chalk.gray(`  Project: ${defaultProject}`))
  logger.log(chalk.gray(`  Environment: ${defaultEnvironment}`))
  if (argv.length > 0) {
    logger.log(chalk.gray(`  Schema file: ${argv[0]}`))
    if (argv.length > 1) {
      logger.log(chalk.gray(`  Output file: ${argv[1]}`))
    }
  }
  logger.log('')
  logger.log(chalk.cyan('Usage:'))
  logger.log(chalk.gray('  $ ov db-diff <schema.json> [output.sql]'))
  logger.log('')

  process.exit(1)
}
