import chalk from 'chalk'
import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Get root directory (parent of cli folder)
export const rootDir = path.resolve(__dirname, '../../')
export const dbLocalDir = path.resolve(rootDir, 'i13e/db/local')

// Logger utility
export const logger = {
  success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`ℹ ${msg}`)),
  warn: (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`)),
}

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
export async function checkPodmanInstalled(): Promise<boolean> {
  try {
    execSync('podman --version', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export async function checkPodmanRunning(): Promise<boolean> {
  try {
    execSync('podman info', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export async function startPodmanMachine(): Promise<boolean> {
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

export async function checkPodmanResources(): Promise<void> {
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
