import prompts from 'prompts'
import { execSync, spawn } from 'child_process'
import path from 'path'
import { writeFileSync, existsSync, mkdirSync, createWriteStream } from 'fs'
import { config } from 'dotenv'

import { logger, rootDir } from './index.js'

const getDbLocalDir = () => path.resolve(rootDir, 'i13e/db/local')

// Utility to check if Podman command exists
export function getPodmanCommand(): string | null {
  try {
    execSync('podman --version', { stdio: 'pipe' })
    return 'podman'
  } catch {
    return null
  }
}

// Podman utilities
async function checkPodmanInstalled(): Promise<boolean> {
  try {
    execSync('podman --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function checkPodmanRunning(): Promise<boolean> {
  try {
    execSync('podman info', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function startPodmanMachine(): Promise<boolean> {
  try {
    logger.info('Starting Podman machine...')
    execSync('podman machine start', { stdio: 'inherit' })
    logger.success('Podman machine started')
    return true
  } catch {
    logger.error('Failed to start Podman machine')
    return false
  }
}

async function checkPodmanResources(): Promise<void> {
  try {
    const info = execSync('podman system info --format json', { stdio: 'pipe' }).toString()
    const systemInfo = JSON.parse(info)

    const cpus = systemInfo.host?.cpus || 0
    const memoryBytes = systemInfo.host?.memFree || 0
    const memoryGb = memoryBytes / (1024 * 1024 * 1024)

    if (cpus < 4 || memoryGb < 8) {
      logger.warn(
        `Podman resources below recommended: ${cpus} CPU(s), ${memoryGb.toFixed(2)} GB RAM`,
      )
      logger.warn('Recommended: 4 CPU(s) and 8 GB RAM')
    }
  } catch {
    // Silently fail if unable to check resources
  }
}

// Wait for container to be healthy with static feedback
async function waitForContainerHealth(
  podmanCmd: string,
  containerName: string,
  timeoutMs: number = 600000, // 10 minutes default
  intervalMs: number = 5000, // 5 seconds between checks
): Promise<void> {
  const startTime = Date.now()

  const getContainerStatus = (): string | null => {
    try {
      const result = execSync(
        `${podmanCmd} inspect --format "{{.State.Health.Status}}" ${containerName}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim()
      return result
    } catch {
      // Container might not exist yet or no health check defined
      try {
        const running = execSync(
          `${podmanCmd} inspect --format "{{.State.Running}}" ${containerName}`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim()
        return running === 'true' ? 'running' : 'not-running'
      } catch {
        return null
      }
    }
  }

  return new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = Date.now() - startTime
      if (elapsed > timeoutMs) {
        reject(new Error(`Timeout waiting for container ${containerName} to be up and ready`))
        return
      }

      const status = getContainerStatus()

      if (status === 'healthy') {
        resolve()
        return
      }

      setTimeout(check, intervalMs)
    }

    check()
  })
}

// Download wallet ZIP from container
async function downloadWalletZipFromContainer(
  podmanCmd: string,
  containerName: string,
  outputZipPath: string,
): Promise<void> {
  mkdirSync(path.dirname(outputZipPath), { recursive: true })

  const zipCommand = [
    'set -euo pipefail',
    'cd /u01/app/oracle/wallets/tls_wallet',
    'shopt -s dotglob',
    'zip -r -X -q - *',
  ].join(' && ')

  await new Promise<void>((resolve, reject) => {
    const child = spawn(podmanCmd, ['exec', containerName, 'bash', '-lc', zipCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const output = createWriteStream(outputZipPath)
    child.stdout?.pipe(output)

    let stderr = ''
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString()
    })

    child.on('error', (error) => reject(error))
    child.on('exit', (code) => {
      output.close()
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(stderr || `podman exec exited with code ${code}`))
      }
    })
  })
}

// Get list of database containers
async function getDatabaseContainers(podmanCmd: string): Promise<string[]> {
  try {
    const output = execSync(`${podmanCmd} ps -a --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return output.split('\n').filter((name) => name && name.includes('db'))
  } catch {
    return []
  }
}

// Get list of database containers
async function getRunningDatabaseContainers(podmanCmd: string): Promise<string[]> {
  try {
    const output = execSync(`${podmanCmd} ps --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim()
    return output.split('\n').filter((name) => name && name.includes('db'))
  } catch {
    return []
  }
}

// Wait for database to be ready
async function waitForDatabaseReady(podmanCmd: string, containerName: string): Promise<void> {
  logger.info('Waiting for database to be up and ready...')
  logger.muted('This may take a few minutes while the database initializes. Please wait...\n')
  try {
    await waitForContainerHealth(podmanCmd, containerName)
    logger.success('Database is up and ready')
  } catch (error) {
    logger.error(`${error}`)
    process.exit(1)
  }
}

// Remove a local database container
export async function removeLocalDatabase(containerName?: string): Promise<void> {
  logger.info('Removing local Oracle Database container...')

  const podmanCmd = getPodmanCommand()
  if (!podmanCmd) {
    logger.error('Podman command not found')
    process.exit(1)
  }

  const podmanRunning = await checkPodmanRunning()
  if (!podmanRunning) {
    logger.error('Podman is not running')
    process.exit(1)
  }

  let targetContainer = containerName

  if (!targetContainer) {
    const containers = await getRunningDatabaseContainers(podmanCmd)

    if (containers.length === 0) {
      logger.warn('No database containers found')
      return
    }

    if (containers.length === 1) {
      targetContainer = containers[0]
    } else {
      const response = await prompts({
        type: 'select',
        name: 'container',
        message: 'Select container to remove',
        choices: containers.map((c) => ({ title: c, value: c })),
      })
      targetContainer = response.container
    }
  }

  if (!targetContainer) {
    logger.error('No container selected')
    process.exit(1)
  }

  const confirm = await prompts({
    type: 'confirm',
    name: 'remove',
    message: `Are you sure you want to remove container "${targetContainer}"?`,
    initial: false,
  })

  if (!confirm.remove) {
    logger.info('Operation cancelled')
    return
  }

  try {
    execSync(`${podmanCmd} compose down`, { cwd: getDbLocalDir(), stdio: 'pipe' })
    logger.success(`Container "${targetContainer}" removed successfully`)
  } catch (error) {
    logger.error(`Failed to remove container: ${error}`)
    process.exit(1)
  }
}

// Setup local database mode
export async function setupLocalDatabase(
  project: string = 'odbvue',
  environment: string = 'dev',
): Promise<void> {
  logger.info(
    `Setting up local Oracle Database for project: ${project}, environment: ${environment}...`,
  )

  const podmanInstalled = await checkPodmanInstalled()
  if (!podmanInstalled) {
    logger.error('Podman is not installed')
    logger.warn('Please install Podman from: https://podman.io/docs/installation')
    process.exit(1)
  }

  logger.success('Podman is installed')

  const podmanRunning = await checkPodmanRunning()
  if (!podmanRunning) {
    logger.warn('Podman is not running')
    const response = await prompts({
      type: 'confirm',
      name: 'startPodman',
      message: 'Would you like to start Podman machine?',
      initial: true,
    })

    if (response.startPodman) {
      const started = await startPodmanMachine()
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

  await checkPodmanResources()

  const getExampleConfigDir = () => path.resolve(rootDir, 'config', 'example', environment)
  const exampleConfigPath = path.resolve(getExampleConfigDir(), '.env.example')

  const getTargetConfigDir = () => path.resolve(rootDir, 'config', project, environment)

  if (!existsSync(exampleConfigPath)) {
    logger.error(`Example .env file not found at: ${exampleConfigPath}`)
    process.exit(1)
  }

  // Load and display content as object from config/example/dev/.env.example
  const exampleConfigObject = config({ path: exampleConfigPath }).parsed || {}

  // Password validation function
  const validatePassword = (password: string): boolean | string => {
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
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return 'Password must contain at least one symbol'
    }
    return true
  }

  const dbParams = await prompts([
    {
      type: 'text',
      name: 'containerName',
      message: 'CONTAINER_NAME',
      initial: `${project}-db-${environment}`,
      validate: (value) => (value.trim() ? true : 'Container name cannot be empty'),
    },
    {
      type: 'password',
      name: 'adminPassword',
      message: 'ADMIN_PASSWORD',
      initial: exampleConfigObject['DB_ADMIN_PASSWORD'] || 'MySecurePass123!',
      validate: validatePassword,
    },
    {
      type: 'password',
      name: 'walletPassword',
      message: 'WALLET_PASSWORD',
      initial: exampleConfigObject['DB_WALLET_PASSWORD'] || 'MySecurePass123!',
      validate: validatePassword,
    },
    {
      type: 'text',
      name: 'schemaName',
      message: 'SCHEMA_NAME',
      initial: 'ODBVUE',
    },
    {
      type: 'password',
      name: 'schemaPassword',
      message: 'SCHEMA_PASSWORD',
      initial: 'MySecurePass123!',
      validate: validatePassword,
    },
  ])

  // Generate .env file in config directory
  logger.info('Generating .env file...')
  mkdirSync(getTargetConfigDir(), { recursive: true })
  const envPath = path.resolve(getTargetConfigDir(), '.env')
  const envContent = `DB_CONTAINER_NAME="${dbParams.containerName}"\nDB_ADMIN_USERNAME="ADMIN"\nDB_ADMIN_PASSWORD="${dbParams.adminPassword}"\nDB_WALLET_PASSWORD="${dbParams.walletPassword}"\nDB_SCHEMA_USERNAME="${dbParams.schemaName}"\nDB_SCHEMA_PASSWORD="${dbParams.schemaPassword}"`
  writeFileSync(envPath, envContent, 'utf-8')
  logger.success(`Generated .env file at: ${envPath}`)

  // check if container with same name is already running
  const podmanCmd = getPodmanCommand()
  if (!podmanCmd) {
    logger.error('Podman command not found')
    process.exit(1)
  }

  const existingContainers = await getDatabaseContainers(podmanCmd)

  if (!existingContainers.includes(dbParams.containerName)) {
    try {
      const envFilePath = path.resolve(getTargetConfigDir(), '.env')
      execSync(`${podmanCmd} compose --env-file "${envFilePath}" up -d --build`, {
        cwd: getDbLocalDir(),
        stdio: 'pipe',
      })
      logger.success('Database container started')
    } catch (error) {
      logger.error(`Failed to start container: ${error}`)
      process.exit(1)
    }

    // Wait for container to be up and ready
    await waitForDatabaseReady(podmanCmd, dbParams.containerName)
  } else {
    logger.warn(`Container with name "${dbParams.containerName}" already exists.`)

    const existingRunningContainers = await getRunningDatabaseContainers(podmanCmd)
    if (!existingRunningContainers.includes(dbParams.containerName)) {
      const response = await prompts({
        type: 'confirm',
        name: 'startExisting',
        message: `The container "${dbParams.containerName}" is not running. Do you want to start it?`,
        initial: true,
      })

      if (response.startExisting) {
        // Start existing container
        logger.info(`Starting existing container "${dbParams.containerName}"...`)
        try {
          execSync(`${podmanCmd} start ${dbParams.containerName}`, { stdio: 'pipe' })
          logger.success(`Container "${dbParams.containerName}" started successfully`)
        } catch (error) {
          logger.error(`Failed to start container: ${error}`)
          process.exit(1)
        }

        // Wait for container to be up and ready
        await waitForDatabaseReady(podmanCmd, dbParams.containerName)
      } else {
        logger.info('Setup cancelled')
        process.exit(0)
      }
    }
  }
  // Download wallet
  logger.info('Downloading wallet from container...')
  const walletsDir = path.resolve(getTargetConfigDir(), '.wallets')
  const walletZipPath = path.resolve(walletsDir, `${dbParams.containerName}.zip`)

  try {
    await downloadWalletZipFromContainer(podmanCmd, dbParams.containerName, walletZipPath)
    logger.success(`Wallet downloaded and saved to: ${walletZipPath}`)
  } catch (error) {
    logger.error(`Failed to download wallet: ${error}`)
    process.exit(1)
  }

  // Final success message
  logger.success('Local database setup completed successfully!')
  logger.muted(`Oracle Rest Data Services is running at: https://localhost:8443/ords/`)
  logger.muted('Configure database connection: ')
  logger.muted(`  username: ADMIN`)
  logger.muted(`  password: ************`)
  logger.muted(`  wallet: ${walletZipPath}`)
  logger.muted('')
}
