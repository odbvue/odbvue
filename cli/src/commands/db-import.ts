import chalk from 'chalk'
import { logger } from '../index.js'
import { importSchema, importSchemaDir } from '../db.js'

export async function handleDbImport(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  const inputPath = argv[0]
  const outputPath = argv[1]

  if (!inputPath || !outputPath) {
    logger.error('Input path and output path are required')
    logger.log('')
    logger.log(chalk.cyan('Usage:'))
    logger.log(chalk.gray('  $ ov db-import <input-dir> <output-dir>'))
    logger.log(chalk.gray('  $ ov di <input-dir> <output-dir>'))
    logger.log(chalk.gray('  $ ov db-import <input.json> <output.sql>  (legacy single-file)'))
    logger.log('')
    logger.log(chalk.cyan('Description:'))
    logger.log(chalk.gray('  Generates SQL DDL from JSON schema files'))
    logger.log(chalk.gray('  Input: db/schema/tables/*.json'))
    logger.log(chalk.gray('  Output: db/schema/tables/*.sql'))
    logger.log('')
    logger.log(chalk.cyan('Examples:'))
    logger.log(chalk.gray('  $ ov di db/schema/tables db/schema/tables'))
    logger.log('')
    process.exit(1)
  }

  try {
    // Check if inputPath is a directory or a file
    if (inputPath.endsWith('.json')) {
      // Legacy single-file mode
      await importSchema(defaultProject, defaultEnvironment, inputPath, outputPath)
    } else {
      // Multi-file mode: process all JSON files in directory
      await importSchemaDir(defaultProject, defaultEnvironment, inputPath, outputPath)
    }
  } catch {
    logger.error('Failed to import schema')
    process.exit(1)
  }
}
