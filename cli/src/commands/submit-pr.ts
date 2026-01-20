import { Command } from 'commander'
import {
  logger,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
  expandZipToDirectory,
  detectPreferredTnsAlias,
} from '../utils.js'
import prompts from 'prompts'
import yaml from 'js-yaml'

interface ProjectConfig {
  project?: string
  environment?: string
  database?: string
}

interface DbEnv {
  DB_ADMIN_USERNAME?: string
  DB_ADMIN_PASSWORD?: string
  DB_WALLET_PATH?: string
  DB_WALLET_PASSWORD?: string
  DB_SCHEMA_USERNAME?: string
  DB_SCHEMA_PASSWORD?: string
  DB_CONNECT_STRING?: string
  [key: string]: string | undefined
}

/**
 * Load project configuration from config/config.yaml
 */
function loadProjectConfig(): ProjectConfig {
  const configPath = path.join(rootDir, 'config', 'config.yaml')

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}. Run 'ov setup' first.`)
  }

  const content = readFileSync(configPath, 'utf-8')
  return (yaml.load(content) as ProjectConfig) || {}
}

/**
 * Load environment variables from config/<environment>/.env
 */
function loadEnv(environment: string): DbEnv {
  const envPath = path.join(rootDir, 'config', environment, '.env')

  if (!existsSync(envPath)) {
    throw new Error(`Environment config not found: ${envPath}. Run 'ov setup-local' first.`)
  }

  const env: DbEnv = {}
  const content = readFileSync(envPath, 'utf-8')

  content.split('\n').forEach((line) => {
    const match = line.match(/^\s*([^#=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim().replace(/^['"]|['"]$/g, '')
      env[key] = value
    }
  })

  return env
}

/**
 * Build SQLcl connection string and get wallet path for TNS_ADMIN
 * Returns { connection, tnsAdmin } where tnsAdmin is the wallet directory path
 */
function buildConnectionInfo(
  env: DbEnv,
  environment: string,
): { connection: string; tnsAdmin: string | null } {
  const user = env.DB_SCHEMA_USERNAME || env.DB_ADMIN_USERNAME
  const password = env.DB_SCHEMA_PASSWORD || env.DB_ADMIN_PASSWORD

  if (!user || !password) {
    throw new Error(
      `Missing DB credentials in config/${environment}/.env. ` +
        'Set DB_SCHEMA_USERNAME/DB_SCHEMA_PASSWORD or DB_ADMIN_USERNAME/DB_ADMIN_PASSWORD',
    )
  }

  // For wallet-based connection
  if (env.DB_WALLET_PATH) {
    const configDir = path.join(rootDir, 'config', environment)
    let walletPath = env.DB_WALLET_PATH

    // Resolve relative path
    if (walletPath.startsWith('./') || walletPath.startsWith('../')) {
      walletPath = path.resolve(configDir, walletPath)
    }

    // If it's a zip, extract to same location (without .zip)
    if (walletPath.endsWith('.zip')) {
      const extractedDir = walletPath.replace('.zip', '')
      const tnsPath = path.join(extractedDir, 'tnsnames.ora')

      if (!existsSync(tnsPath)) {
        if (!existsSync(walletPath)) {
          throw new Error(`Wallet zip file not found: ${walletPath}`)
        }
        // Extract wallet
        logger.muted('Extracting wallet from zip...')
        expandZipToDirectory(walletPath, extractedDir)
      }
      walletPath = extractedDir
    }

    // Check if wallet directory is valid
    const tnsPath = path.join(walletPath, 'tnsnames.ora')
    if (!existsSync(tnsPath)) {
      throw new Error(`Wallet directory invalid: tnsnames.ora not found in ${walletPath}`)
    }

    // Get preferred TNS alias from tnsnames.ora
    const tnsContent = readFileSync(tnsPath, 'utf-8')
    const connectString =
      env.DB_CONNECT_STRING || detectPreferredTnsAlias(tnsContent) || 'myatp_high'

    // Return simple connection format with TNS alias - TNS_ADMIN will be set via env
    return {
      connection: `${user}/${password}@${connectString}`,
      tnsAdmin: walletPath,
    }
  }

  // Fallback: simple connection string (no wallet)
  const connectString = env.DB_CONNECT_STRING
  if (connectString) {
    return {
      connection: `${user}/${password}@${connectString}`,
      tnsAdmin: null,
    }
  }

  return {
    connection: `${user}/${password}`,
    tnsAdmin: null,
  }
}

export const registerSubmitPrCommand = (program: Command) => {
  program
    .command('submit-pr')
    .alias('sp')
    .description('Submit PR with database changes and changeset')
    .option(
      '-e, --environment <environment>',
      'Environment name (uses config/config.yaml if not provided)',
    )
    .action(async (options: { environment?: string }) => {
      try {
        // Check for uncommitted changes
        const status = execSync('git status --porcelain', {
          cwd: rootDir,
          encoding: 'utf-8',
        }).trim()

        if (status) {
          logger.error('You have uncommitted changes. Please commit or stash them first.')
          process.exit(1)
        }

        // Load configuration
        let environment = options.environment

        if (!environment) {
          try {
            const projectConfig = loadProjectConfig()
            environment = projectConfig.environment
          } catch {
            // Config file doesn't exist
          }
        }

        if (!environment) {
          logger.error('Environment not specified and config/config.yaml not found.')
          logger.info('Usage: ov submit-pr [-e, --environment <environment>]')
          logger.info("Or run 'ov setup' to configure the project first.")
          process.exit(1)
        }

        // Load environment-specific config
        const env = loadEnv(environment)
        const { connection, tnsAdmin } = buildConnectionInfo(env, environment)

        logger.info(`Staging database changes for environment: ${environment}...`)
        if (tnsAdmin) {
          logger.muted(`Using wallet: ${tnsAdmin}`)
        }

        const dbDir = path.resolve(rootDir, 'db')
        const sqlScript = `connect ${connection}\nproject stage\nexit\n`

        try {
          // Create a temporary file with the SQL script for cross-platform compatibility
          const tempScriptPath = path.resolve(dbDir, '.sql_submit_temp')
          writeFileSync(tempScriptPath, sqlScript)

          try {
            const isWindows = platform() === 'win32'
            const shell = isWindows ? 'powershell.exe' : '/bin/bash'
            const sqlclCommand = `sql /nolog "@${tempScriptPath}"`

            // Pass TNS_ADMIN environment variable if wallet is used
            const execEnv = { ...process.env }
            if (tnsAdmin) {
              execEnv.TNS_ADMIN = tnsAdmin
            }

            execSync(sqlclCommand, {
              cwd: dbDir,
              stdio: 'inherit',
              shell,
              env: execEnv,
            })
          } finally {
            // Clean up temporary file
            try {
              unlinkSync(tempScriptPath)
            } catch {
              // Ignore cleanup errors
            }
          }
        } catch (error) {
          logger.error(`Database project stage failed: ${error}`)
          process.exit(1)
        }

        logger.warn('Please check if staged database content is OK')
        const { confirmStage } = await prompts({
          type: 'confirm',
          name: 'confirmStage',
          message: 'Continue?',
          initial: true,
        })

        if (!confirmStage) {
          logger.info('Aborted by user.')
          process.exit(1)
        }

        logger.info('Staging database changes...')
        execSync('git add db/', { cwd: rootDir, stdio: 'inherit' })

        const appsDir = path.resolve(rootDir, 'apps')

        logger.info('Creating changeset...')
        execSync('pnpm changeset', { cwd: appsDir, stdio: 'inherit' })

        logger.info('Committing changes...')
        execSync('git add .', { cwd: rootDir, stdio: 'inherit' })

        // Get the latest changeset file to extract summary
        let commitMessage = 'changeset: Update version'

        try {
          const changesetFiles = execSync('ls -t .changeset/*.md 2>/dev/null | head -1', {
            cwd: appsDir,
            encoding: 'utf-8',
            shell: '/bin/bash',
          })
            .trim()
            .split('\n')
            .filter((f: string) => f)

          if (changesetFiles.length > 0) {
            const latestFile = path.resolve(appsDir, changesetFiles[0])
            if (existsSync(latestFile)) {
              const content = readFileSync(latestFile, 'utf-8')
              const lines = content.split('\n').filter((line: string) => line.trim())
              if (lines.length > 0) {
                commitMessage = `changeset: ${lines[lines.length - 1]}`
              }
            }
          }
        } catch {
          // Use default message if extraction fails
        }

        execSync(`git commit -m "${commitMessage}"`, { cwd: rootDir, stdio: 'inherit' })

        logger.info('Pushing changes...')
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: rootDir,
          encoding: 'utf-8',
        }).trim()

        execSync(`git push -u origin ${branch}`, { cwd: rootDir, stdio: 'inherit' })

        logger.success(`Pushed to origin/${branch}`)
        logger.success('PR submission completed successfully!')
      } catch (error) {
        logger.error(`Failed to submit PR: ${error}`)
        process.exit(1)
      }
    })
}
