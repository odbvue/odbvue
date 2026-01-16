import chalk from 'chalk'
import { logger } from '../index.js'

export async function handleDbScaffold(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  logger.info('db-scaffold command is under development')
  logger.log('')
  logger.log(chalk.cyan('Description:'))
  logger.log(chalk.gray('  Generates JSON schema from TypeScript definitions'))
  logger.log(chalk.gray('  Source: ./apps/src/api/schema/**/*.ts'))
  logger.log(chalk.gray('  Output: ./db/schema/**/*.json'))
  logger.log('')
  logger.log(chalk.cyan('Configuration:'))
  logger.log(chalk.gray(`  Project: ${defaultProject}`))
  logger.log(chalk.gray(`  Environment: ${defaultEnvironment}`))
  if (argv.length > 0) {
    logger.log(chalk.gray(`  Arguments: ${argv.join(', ')}`))
  }
  logger.log('')
  logger.log(chalk.cyan('Usage:'))
  logger.log(chalk.gray('  $ ov db-scaffold [output-dir]'))
  logger.log('')

  process.exit(1)
}
