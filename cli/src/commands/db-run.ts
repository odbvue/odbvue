import chalk from 'chalk'
import { logger } from '../index.js'
import { runFile } from '../db.js'

export async function handleDbRun(
  argv: string[],
  defaultProject: string,
  defaultEnvironment: string,
) {
  const filePath = argv[0]
  const outputFile = argv[1]

  if (!filePath) {
    logger.error('File or folder path is required')
    logger.log('')
    logger.log(chalk.cyan('Usage:'))
    logger.log(chalk.gray('  $ ov db-run <path> [output-file]'))
    logger.log(chalk.gray('  $ ov dr <path> [output-file]'))
    logger.log('')
    logger.log(chalk.cyan('Supported input types:'))
    logger.log(chalk.gray('  .sql   - Execute SQL file directly'))
    logger.log(chalk.gray('  .ts    - Scaffold API module to SQL, then execute'))
    logger.log(chalk.gray('  folder - Consolidate SQL files from subfolders, then execute'))
    logger.log('')
    logger.log(chalk.cyan('Options:'))
    logger.log(chalk.gray('  [output-file] - Save DBMS output to specified file (optional)'))
    logger.log('')
    process.exit(1)
  }

  try {
    await runFile(defaultProject, defaultEnvironment, filePath, outputFile)
  } catch {
    logger.error('Failed to execute file')
    process.exit(1)
  }
}
