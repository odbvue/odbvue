import chalk from 'chalk'
import prompts from 'prompts'
import { execSync, spawn } from 'child_process'
import path from 'path'
import { writeFileSync, readFileSync, existsSync, mkdirSync, createWriteStream } from 'fs'
import {
  logger,
  dbLocalDir,
  getPodmanCommand,
  checkPodmanInstalled,
  checkPodmanRunning,
  startPodmanMachine,
  checkPodmanResources,
} from './utils.js'

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

// Get list of running database containers
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

// Check if a port is in use and get the container using it
async function getContainerUsingPort(podmanCmd: string, port: number): Promise<string | null> {
  try {
    const containers = execSync(`${podmanCmd} ps --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .trim()
      .split('\n')
      .filter((name) => name)

    for (const container of containers) {
      try {
        const inspect = execSync(`${podmanCmd} inspect ${container}`, {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        })
        const data = JSON.parse(inspect)
        const portBindings = data[0]?.NetworkSettings?.Ports?.[`${port}/tcp`]
        if (portBindings && portBindings.length > 0) {
          return container
        }
      } catch {
        // Container might not have port bindings, continue
      }
    }
  } catch {
    // Silently fail
  }
  return null
}

// Stop a container
async function stopContainer(podmanCmd: string, containerName: string): Promise<boolean> {
  try {
    logger.info(`Stopping container "${containerName}"...`)
    execSync(`${podmanCmd} stop ${containerName}`, { stdio: 'pipe' })
    logger.success(`Container "${containerName}" stopped`)
    return true
  } catch (error) {
    logger.error(`Failed to stop container: ${error}`)
    return false
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
    execSync(`${podmanCmd} compose down`, { cwd: dbLocalDir, stdio: 'pipe' })
    logger.success(`Container "${targetContainer}" removed successfully`)
  } catch (error) {
    logger.error(`Failed to remove container: ${error}`)
    process.exit(1)
  }
}

// Setup local database mode
export async function setupLocalDatabase(): Promise<void> {
  logger.info('Setting up local Oracle Database...')

  const podmanInstalled = await checkPodmanInstalled()
  if (!podmanInstalled) {
    logger.error('Podman is not installed')
    console.log(chalk.yellow('\nPlease install Podman from: https://podman.io/docs/installation\n'))
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

  // Prompt for database parameters
  logger.info('Configuring database parameters...')
  const envExamplePath = path.resolve(dbLocalDir, '.env.example')

  // Read defaults from .env.example
  let defaultContainerName = 'odbvue-db-dev'
  let defaultAdminPassword = 'MySecurePass123!'
  let defaultWalletPassword = 'MySecurePass123!'

  if (existsSync(envExamplePath)) {
    const exampleContent = readFileSync(envExamplePath, 'utf-8')
    const containerMatch = exampleContent.match(/CONTAINER_NAME=(.+)/)
    const adminMatch = exampleContent.match(/ADMIN_PASSWORD="?([^"]+)"?/)
    const walletMatch = exampleContent.match(/WALLET_PASSWORD="?([^"]+)"?/)

    if (containerMatch) defaultContainerName = containerMatch[1].trim()
    if (adminMatch) defaultAdminPassword = adminMatch[1].trim()
    if (walletMatch) defaultWalletPassword = walletMatch[1].trim()
  }

  const dbParams = await prompts([
    {
      type: 'text',
      name: 'containerName',
      message: 'Container name',
      initial: defaultContainerName,
      validate: (value) => (value.trim() ? true : 'Container name cannot be empty'),
    },
    {
      type: 'password',
      name: 'adminPassword',
      message: 'ADMIN_PASSWORD',
      initial: defaultAdminPassword,
    },
    {
      type: 'password',
      name: 'walletPassword',
      message: 'WALLET_PASSWORD',
      initial: defaultWalletPassword,
    },
  ])

  // Generate .env file
  logger.info('Generating .env file...')
  const envPath = path.resolve(dbLocalDir, '.env')
  const envContent = `CONTAINER_NAME=${dbParams.containerName}\nADMIN_PASSWORD="${dbParams.adminPassword}"\nWALLET_PASSWORD="${dbParams.walletPassword}"\n`
  writeFileSync(envPath, envContent, 'utf-8')
  logger.success('Generated .env file')

  // Start container
  logger.info('Starting database container with podman compose...')
  console.log(
    chalk.gray(
      'This may take a few minutes while the image is being pulled and built. Please wait...\n',
    ),
  )
  const podmanCmd = getPodmanCommand()
  if (!podmanCmd) {
    logger.error('Podman command not found')
    process.exit(1)
  }

  // Check if port 1521 is already in use
  const containerUsingPort = await getContainerUsingPort(podmanCmd, 1521)
  if (containerUsingPort) {
    logger.warn(`Port 1521 is already in use by container "${containerUsingPort}"`)
    const response = await prompts({
      type: 'select',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { title: 'Stop the other container and continue', value: 'stop' },
        { title: 'Exit', value: 'exit' },
      ],
    })

    if (response.action === 'exit') {
      logger.info('Setup cancelled')
      process.exit(0)
    }

    if (response.action === 'stop') {
      const stopped = await stopContainer(podmanCmd, containerUsingPort)
      if (!stopped) {
        logger.error('Cannot proceed without stopping the conflicting container')
        process.exit(1)
      }
    }
  }

  try {
    execSync(`${podmanCmd} compose --env-file .env up -d --build`, {
      cwd: dbLocalDir,
      stdio: 'pipe',
    })
    logger.success('Database container started')
  } catch (error) {
    logger.error(`Failed to start container: ${error}`)
    process.exit(1)
  }

  // Wait for container to be up and ready
  logger.info('Waiting for database to be up and ready...')
  console.log(
    chalk.gray('This may take a few minutes while the database initializes. Please wait...\n'),
  )
  try {
    await waitForContainerHealth(podmanCmd, dbParams.containerName)
    logger.success('Database is up and ready')
  } catch (error) {
    logger.error(`${error}`)
    process.exit(1)
  }

  // Download wallet
  logger.info('Downloading wallet from container...')
  const walletsDir = path.resolve(dbLocalDir, '.wallets')
  const walletZipPath = path.resolve(walletsDir, `${dbParams.containerName}.zip`)

  try {
    await downloadWalletZipFromContainer(podmanCmd, dbParams.containerName, walletZipPath)
    logger.success(`Wallet downloaded and saved to: ${walletZipPath}`)
  } catch (error) {
    logger.error(`Failed to download wallet: ${error}`)
    process.exit(1)
  }

  logger.success('Local database setup completed successfully!')
  console.log(
    chalk.gray(`Oracle Rest Data Services is running at: `) +
      chalk.cyan(`https://localhost:8443/ords/`),
  )
  console.log(chalk.gray(`Configure database connection: `))
  console.log(chalk.gray(`  wallet: `) + chalk.cyan(`${walletZipPath}`))
  console.log(chalk.gray(`  username: `) + chalk.cyan(`ADMIN`))
  console.log(chalk.gray(`  password: `) + chalk.cyan(`************`))
  console.log('')
}
