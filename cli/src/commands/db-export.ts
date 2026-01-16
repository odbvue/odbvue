import chalk from 'chalk'
import { logger } from '../index.js'
import { exportSchema } from '../db.js'

export async function handleDbExport(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  const outputFile = argv[0]

  if (!outputFile) {
    logger.error('Output file path is required')
    logger.log('')
    logger.log(chalk.cyan('Usage:'))
    logger.log(chalk.gray('  $ ov db-export <output.json>'))
    logger.log(chalk.gray('  $ ov de <output.json>'))
    logger.log('')
    logger.log(chalk.cyan('Description:'))
    logger.log(chalk.gray('  Exports database schema to JSON using odbvue.export_schema'))
    logger.log(chalk.gray('  Uses DB_SCHEMA_USERNAME from .env for the schema to export'))
    logger.log('')
    process.exit(1)
  }

  try {
    await exportSchema(defaultProject, defaultEnvironment, outputFile)
  } catch {
    logger.error('Failed to export schema')
    process.exit(1)
  }
}
