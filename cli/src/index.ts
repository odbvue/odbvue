import chalk from 'chalk'
import prompts from 'prompts'
import {
  setupLocalDatabase,
  removeLocalDatabase,
  runFile,
  exportSchema,
  importSchema,
} from './db.js'
import { handleCommitAll } from './cicd.js'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get root directory (parent of cli folder)
export const rootDir = path.resolve(__dirname, '../../')

// Load config with default profile
function loadConfig() {
  const configPath = path.join(rootDir, 'config.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'))
  } catch {
    return { defaultProfile: { project: 'odbvue', environment: 'dev' } }
  }
}

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
  const config = loadConfig()
  const { project: defaultProject, environment: defaultEnvironment } = config.defaultProfile

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
        initial: defaultProject,
        validate: (value) => (value.trim() ? true : 'Project cannot be empty'),
      },
      {
        type: 'text',
        name: 'environment',
        message: 'Environment',
        initial: defaultEnvironment,
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
      logger.info('Running database setup scripts...')
      await runFile(setupMode.project, setupMode.environment, 'db/releases/next/setup.sql')
    } else if (setupMode.database === 'oci') {
      logger.info('Cloud setup coming soon...')
    }

    return
  }

  if (command === 'db-setup-local') {
    const project = args[0] || defaultProject
    const environment = args[1] || defaultEnvironment
    await setupLocalDatabase(project, environment)
    return
  }

  if (command === 'db-remove-local') {
    const containerName = args[0]
    await removeLocalDatabase(containerName)
    return
  }

  if (command === 'db-run' || command === 'dr') {
    const filePath = args[0]
    const outputFile = args[1]
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
    return
  }

  if (command === 'db-export' || command === 'de') {
    const outputFile = args[0]
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
    return
  }

  if (command === 'db-import' || command === 'di') {
    const inputFile = args[0]
    const outputFile = args[1]
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
    return
  }

  if (command === 'commit-all' || command === 'ca') {
    await handleCommitAll()
    return
  }

  if (command === 'load-env' || command === 'le') {
    const envPath = args[0]
    if (!envPath) {
      logger.error('Environment file path is required')
      logger.log('')
      logger.log(chalk.cyan('Usage:'))
      logger.log(chalk.gray('  $ ov load-env <path>'))
      logger.log(chalk.gray('  $ ov le <path>'))
      logger.log('')
      process.exit(1)
    }

    try {
      const absolutePath = path.isAbsolute(envPath) ? envPath : path.resolve(rootDir, envPath)

      if (!fs.existsSync(absolutePath)) {
        throw new Error(`Environment file not found: ${absolutePath}`)
      }

      const envContent = fs.readFileSync(absolutePath, 'utf-8')
      const lines = envContent.split('\n')

      logger.success(`Loaded environment from: ${absolutePath}`)
      logger.log('')
      logger.log(chalk.cyan('Environment variables:'))
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const [key] = trimmed.split('=')
          logger.muted(`  ${key}=${trimmed.split('=').slice(1).join('=').replace(/"/g, '')}`)
        }
      }
    } catch (err) {
      logger.error(
        `Failed to load environment file: ${err instanceof Error ? err.message : String(err)}`,
      )
      process.exit(1)
    }
    return
  }

  logger.log(
    chalk.gray('  db-setup-local [project] [environment]') +
      chalk.reset('   Setup local database (default: odbvue, dev)'),
  )
  logger.log(
    chalk.gray('  db-run, dr [path] [output-file]') +
      chalk.reset('   Execute SQL or TypeScript API file against Oracle Database'),
  )
  logger.log(
    chalk.gray('  db-export, de <output.json>') +
      chalk.reset('         Export schema to JSON using odbvue.export_schema'),
  )
  logger.log(
    chalk.gray('  db-import, di <input.json> <output.sql>') +
      chalk.reset('  Generate SQL DDL from JSON schema'),
  )
  logger.log(
    chalk.gray('  load-env, le [path]') +
      chalk.reset('       Load and display environment variables from .env file'),
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
  logger.log(chalk.gray('  $ ov dr ./data.sql ./output.log'))
  logger.log(chalk.gray('  $ ov dr apps/src/api/index.ts'))
  logger.log(chalk.gray('  $ ov dr apps/src/api/index.ts ./output.log'))
  logger.log(chalk.gray('  $ ov db-export ./schema.json'))
  logger.log(chalk.gray('  $ ov de ./schema.json'))
  logger.log(chalk.gray('  $ ov db-import ./schema.json ./schema.sql'))
  logger.log(chalk.gray('  $ ov di ./schema.json ./schema.sql'))
  logger.log(chalk.gray('  $ ov load-env ./config/odbvue/dev/.env'))
  logger.log(chalk.gray('  $ ov le ./config/odbvue/dev/.env'))
}

main()
