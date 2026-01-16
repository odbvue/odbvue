import chalk from 'chalk'
import { logger } from '../index.js'
import { importSchema } from '../db.js'

export async function handleDbImport(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  const inputFile = argv[0]
  const outputFile = argv[1]

  if (!inputFile || !outputFile) {
    logger.error('Input JSON file and output SQL file are required')
    logger.log('')
    logger.log(chalk.cyan('Usage:'))
    logger.log(chalk.gray('  $ ov db-import <input.json> <output.sql>'))
    logger.log(chalk.gray('  $ ov di <input.json> <output.sql>'))
    logger.log('')
    logger.log(chalk.cyan('Description:'))
    logger.log(chalk.gray('  Generates SQL DDL from JSON schema using odbvue.import_schema'))
    logger.log(chalk.gray('  Uses DB_SCHEMA_USERNAME from .env for the target schema'))
    logger.log('')
    process.exit(1)
  }

  try {
    await importSchema(defaultProject, defaultEnvironment, inputFile, outputFile)
  } catch {
    logger.error('Failed to import schema')
    process.exit(1)
  }
}
