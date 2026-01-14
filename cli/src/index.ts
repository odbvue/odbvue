import chalk from 'chalk'
import prompts from 'prompts'
import { setupLocalDatabase, removeLocalDatabase } from './db-local.js'
//import { runSqlFile } from './db-run.js'
import { handleCommitAll } from './cicd.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get root directory (parent of cli folder)
export const rootDir = path.resolve(__dirname, '../../')

// Simple logger utility
export const logger = {
  log: (msg: string) => console.log(msg),
  muted: (msg: string) => console.log(chalk.gray(msg)),
  success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`ℹ ${msg}`)),
  warn: (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`)),
}

export default logger

// Main function to handle CLI commands
export async function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  const args = argv.slice(1)

  if (command === 'setup') {
    logger.log(
      'Setup OdbVue - a template + reference implementation for building and deploying business-class apps',
    )
    logger.log('')

    const setupMode = await prompts([
      {
        type: 'text',
        name: 'project',
        message: 'Project',
        initial: 'odbvue',
        validate: (value) => (value.trim() ? true : 'Project cannot be empty'),
      },
      {
        type: 'text',
        name: 'environment',
        message: 'Environment',
        initial: 'dev',
        validate: (value) => (value.trim() ? true : 'Environment cannot be empty'),
      },
      {
        type: 'select',
        name: 'database',
        message: 'Database deployment',
        choices: [
          { title: 'local', description: 'Podman is required', value: 'local' },
          {
            title: 'cloud',
            description: 'Oracle Cloud account is required',
            value: 'oci',
          },
        ],
        initial: 0,
      },
    ])

    if (setupMode.database === 'local') {
      await setupLocalDatabase(setupMode.project, setupMode.environment)
    } else if (setupMode.database === 'oci') {
      logger.info('Cloud setup coming soon...')
    }

    return
  }

  if (command === 'db-setup-local') {
    const project = args[0] || 'odbvue'
    const environment = args[1] || 'dev'
    await setupLocalDatabase(project, environment)
    return
  }

  if (command === 'db-remove-local') {
    const containerName = args[0]
    await removeLocalDatabase(containerName)
    return
  }

  if (command === 'db-run' || command === 'dr') {
    const sqlFilePath = args[0]
    if (!sqlFilePath) {
      logger.error('SQL file path is required')
      logger.log('')
      logger.log(chalk.cyan('Usage:'))
      logger.log(chalk.gray('  $ ov db-run <sql-file-path>'))
      logger.log(chalk.gray('  $ ov dr <sql-file-path>'))
      logger.log('')
      process.exit(1)
    }
    //await runSqlFile(sqlFilePath)
    return
  }

  if (command === 'commit-all' || command === 'ca') {
    await handleCommitAll()
    return
  }

  logger.log(
    chalk.gray('  db-setup-local [project] [environment]') +
      chalk.reset('   Setup local database (default: odbvue, dev)'),
  )
  logger.log(
    chalk.gray('  db-run, dr [path]') +
      chalk.reset('      Execute SQL file against Oracle Database'),
  )
  logger.log(
    chalk.gray('  commit-all, ca') +
      chalk.reset('       Commit all changes with conventional commit format'),
  )
  logger.log('')
  logger.log(chalk.cyan('Examples:'))
  logger.log('')
  logger.log(chalk.gray('  $ ov setup'))
  logger.log(chalk.gray('  $ ov db-setup-local'))
  logger.log(chalk.gray('  $ ov db-setup-local prod'))
  logger.log(chalk.gray('  $ ov db-remove-local db-dev'))
  logger.log(chalk.gray('  $ ov db-run ./schema.sql'))
  logger.log(chalk.gray('  $ ov dr ./data.sql'))
}

main()
