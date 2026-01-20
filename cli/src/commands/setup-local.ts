import { Command } from 'commander'
import {
  logger,
  chalk,
  getPodmanCommand,
  rootDir,
  expandZipToDirectory,
  detectPreferredTnsAlias,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  getDefaultEnvironment,
  execSync,
} from '../utils.js'
import prompts from 'prompts'
import {
  checkPodmanInstalled,
  checkPodmanRunning,
  startPodmanMachine,
  checkPodmanResources,
  getDatabaseContainers,
  getRunningDatabaseContainers,
  downloadWalletZipFromContainer,
  waitForContainerHealth,
} from '../utils/podman.js'

// ============================================================================
// Password Validation Helper Functions
// ============================================================================

/**
 * Validate Oracle password meets complexity requirements
 */
const validatePassword = (password: string): string | null => {
  if (password.length < 12) {
    return 'Password must be at least 12 characters'
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter'
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter'
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number'
  }
  const symbols = /[!@#$%^&*()_+={}:"|,.<>?;'\\[\\]-]/
  if (!symbols.test(password)) {
    return 'Password must contain at least one symbol'
  }
  return null
}

/**
 * Prompt for password with validation
 */
const promptPassword = async (message: string, defaultValue: string): Promise<string> => {
  let password = ''
  let validationError: string | null = null

  do {
    const response = await prompts({
      type: 'text',
      name: 'value',
      message: `${message} [${defaultValue}]`,
    })
    password = response.value?.trim() || defaultValue
    validationError = validatePassword(password)
    if (validationError) {
      logger.warn(validationError)
    }
  } while (validationError)

  return password
}

// ============================================================================
// Main Setup Function
// ============================================================================

export const setupLocalAction = async (
  options: { project?: string; environment?: string } = {},
) => {
  const project = options.project || 'odbvue'
  const environment = options.environment || getDefaultEnvironment()

  logger.info(chalk.bold('Local Database Setup'))
  logger.msg('')
  logger.info(
    `Setting up local Oracle Database for project: ${project}, environment: ${environment}`,
  )
  logger.msg('')

  // Step a) Check if Podman is installed
  const podmanCmd = getPodmanCommand()
  if (!checkPodmanInstalled(podmanCmd)) {
    logger.error('Podman is not installed')
    logger.warn('Please install Podman from: https://podman.io/docs/installation')
    process.exit(1)
  }

  const podmanCmdStr = podmanCmd!
  logger.success('Podman is installed')

  // Step b) Check if Podman is running, attempt to start if not
  if (!checkPodmanRunning(podmanCmdStr)) {
    logger.warn('Podman is not running')
    const { startPodman } = await prompts({
      type: 'confirm',
      name: 'startPodman',
      message: 'Would you like to start Podman machine?',
      initial: false,
    })

    if (startPodman) {
      const started = startPodmanMachine(podmanCmdStr)
      if (!started) {
        logger.error('Cannot proceed without Podman running')
        process.exit(1)
      }
    } else {
      logger.error('Podman must be running to continue')
      process.exit(1)
    }
  }

  logger.success('Podman is running and ready')

  // Check Podman resources
  checkPodmanResources(podmanCmdStr)

  // Construct container name: <project>-db-<environment>
  const defaultContainerName = `${project}-db-${environment}`
  const { containerName: containerNameInput } = await prompts({
    type: 'text',
    name: 'containerName',
    message: 'Container name',
    initial: defaultContainerName,
  })
  const containerName = containerNameInput?.trim() || defaultContainerName

  // Step c) Check if container exists
  const existingContainers = getDatabaseContainers(podmanCmdStr)
  const runningContainers = getRunningDatabaseContainers(podmanCmdStr)

  const localDbDir = path.resolve(rootDir, 'i13e/local/db')
  if (!existsSync(localDbDir)) {
    logger.error(`Local DB folder not found: ${localDbDir}`)
    process.exit(1)
  }

  // Prompt for passwords
  const defaultPassword = 'MySecurePass123!'
  const defaultSchemaName = 'ODBVUE'
  logger.msg('')
  logger.info(
    'Passwords (must be at least 12 chars with uppercase, lowercase, number, and symbol):',
  )

  const adminPassword = await promptPassword('ADMIN_PASSWORD', defaultPassword)
  const walletPassword = await promptPassword('WALLET_PASSWORD', defaultPassword)

  const { schemaUsername } = await prompts({
    type: 'text',
    name: 'schemaUsername',
    message: `SCHEMA_USERNAME`,
    initial: defaultSchemaName,
  })
  const schemaName = schemaUsername?.trim() || defaultSchemaName
  const schemaPassword = await promptPassword('SCHEMA_PASSWORD', defaultPassword)

  // Write .env file for local DB
  const localDbEnvPath = path.resolve(localDbDir, '.env')
  writeFileSync(
    localDbEnvPath,
    `CONTAINER_NAME="${containerName}"\nADMIN_PASSWORD="${adminPassword}"\nWALLET_PASSWORD="${walletPassword}"\n`,
    'utf-8',
  )
  logger.success('Local DB .env written')

  if (existingContainers.includes(containerName)) {
    // c1) Container exists
    logger.warn(`Container with name "${containerName}" already exists`)

    if (!runningContainers.includes(containerName)) {
      // Container exists but not running - attempt to start
      const { startContainer } = await prompts({
        type: 'confirm',
        name: 'startContainer',
        message: `The container "${containerName}" is not running. Start it?`,
        initial: true,
      })

      if (startContainer) {
        logger.info(`Starting existing container "${containerName}"...`)
        try {
          execSync(`${podmanCmdStr} start ${containerName}`, { stdio: 'pipe' })
          logger.success(`Container "${containerName}" started successfully`)
        } catch (error) {
          logger.error(`Failed to start container: ${error}`)
          process.exit(1)
        }

        // Wait for container to be up and ready
        logger.info('Waiting for database to be up and ready (this may take a few minutes)...')
        try {
          await waitForContainerHealth(podmanCmdStr, containerName)
          logger.success('Database is up and ready')
        } catch (error) {
          logger.error(`${error}`)
          process.exit(1)
        }
      } else {
        logger.info('Setup cancelled')
        process.exit(0)
      }
    } else {
      logger.info(`Container "${containerName}" is already running`)
    }
  } else {
    // c2) Create and spin up new container
    logger.info('Creating and starting local DB container...')
    try {
      execSync(`${podmanCmdStr} compose up -d --build`, {
        cwd: localDbDir,
        stdio: 'inherit',
      })
      logger.success('Database container started')
    } catch (error) {
      logger.error(`Failed to start container: ${error}`)
      process.exit(1)
    }

    // Wait for container to be up and ready
    logger.info('Waiting for database to be up and ready (this may take 3-5 minutes)...')
    try {
      await waitForContainerHealth(podmanCmdStr, containerName)
      logger.success('Database is up and ready')
    } catch (error) {
      logger.error(`${error}`)
      logger.warn('You can manually wait and then run: ov local-wallet --name ' + containerName)
      process.exit(1)
    }
  }

  // Step d) Download wallet
  const configEnvDir = path.resolve(rootDir, 'config', environment)
  const walletsDir = path.resolve(configEnvDir, '.wallets')
  const walletZipPath = path.resolve(walletsDir, `${containerName}.zip`)
  const walletDir = path.resolve(walletsDir, containerName)

  logger.info('Downloading wallet from container...')
  try {
    await downloadWalletZipFromContainer(podmanCmdStr, containerName, walletZipPath)
    logger.success(`Wallet saved: ${walletZipPath}`)
  } catch (error) {
    logger.error(`Failed to download wallet: ${error}`)
    process.exit(1)
  }

  // Create base64 encoded version of wallet zip
  const walletBase64Path = path.resolve(walletsDir, `${containerName}.txt`)
  const walletZipBuffer = readFileSync(walletZipPath)
  const walletBase64 = walletZipBuffer.toString('base64')
  writeFileSync(walletBase64Path, walletBase64, 'utf-8')
  logger.success(`Wallet base64 saved: ${walletBase64Path}`)

  logger.info('Extracting wallet...')
  expandZipToDirectory(walletZipPath, walletDir)
  const tnsNamesPath = path.resolve(walletDir, 'tnsnames.ora')
  if (!existsSync(tnsNamesPath)) {
    logger.error('Could not find tnsnames.ora in extracted wallet.')
    process.exit(1)
  }
  logger.success(`Wallet extracted: ${walletDir}`)

  // Detect TNS alias
  logger.info('Detecting TNS alias from wallet...')
  const tnsNames = readFileSync(tnsNamesPath, 'utf-8')
  const detectedAlias = detectPreferredTnsAlias(tnsNames)
  if (!detectedAlias) {
    logger.error('Could not detect a TNS alias from tnsnames.ora.')
    process.exit(1)
  }
  logger.success(`Using TNS alias: ${detectedAlias}`)

  // Store connection info in config/<environment>/.env
  const configEnvPath = path.resolve(configEnvDir, '.env')
  const relativeWalletPath = `./.wallets/${containerName}.zip`
  writeFileSync(
    configEnvPath,
    `DB_CONTAINER_NAME="${containerName}"
DB_ADMIN_USERNAME="ADMIN"
DB_ADMIN_PASSWORD="${adminPassword}"
DB_WALLET_PATH="${relativeWalletPath}"
DB_WALLET_PASSWORD="${walletPassword}"
DB_SCHEMA_USERNAME="${schemaName}"
DB_SCHEMA_PASSWORD="${schemaPassword}"
`,
    'utf-8',
  )
  logger.success(`Wrote config/${environment}/.env`)

  // Final success message
  logger.msg('')
  logger.success('Local database setup completed successfully!')
  logger.msg('')
  logger.muted(`Oracle Rest Data Services is running at: https://localhost:8443/ords/`)
  logger.muted('Configure database connection:')
  logger.muted(`  username: ADMIN`)
  logger.muted(`  password: ************`)
  logger.muted(`  wallet: ${walletZipPath}`)
  logger.msg('')
}

export const registerSetupLocalCommand = (program: Command) => {
  program
    .command('setup-local')
    .description('Configure local Oracle Database (Podman container) for development')
    .option('-p, --project <name>', 'Project name', 'odbvue')
    .option('-e, --environment <name>', 'Environment name (default: from config.yaml)')
    .action(setupLocalAction)
}
