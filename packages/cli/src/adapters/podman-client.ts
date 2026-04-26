import { execSync } from 'child_process'
import { spawn } from 'child_process'
import { mkdirSync, createWriteStream } from 'fs'
import { platform } from 'os'
import path from 'path'
import { logger } from '../shared/logger.js'
import { fatalError } from '../shared/errors.js'

export interface ContainerStatus {
  name: string
  status: string
  health: string
}

export class PodmanClient {
  private podmanCmd: string | null

  tryExec = (command: string, cwd?: string): boolean => {
    try {
      execSync(command, {
        cwd,
        stdio: 'ignore',
      })
      return true
    } catch {
      return false
    }
  }

  constructor() {
    this.podmanCmd = null
    const isWindows = platform() === 'win32'
    if (isWindows) {
      if (this.tryExec('podman.exe --version')) {
        this.podmanCmd = 'podman.exe'
      }
    }
    if (this.tryExec('podman --version')) {
      this.podmanCmd = 'podman'
    }
  }

  isInstalled(): boolean {
    if (this.podmanCmd === null) return false
    return this.tryExec(`${this.podmanCmd} --version`)
  }

  isRunning(): boolean {
    if (this.podmanCmd === null) return false
    try {
      execSync(`${this.podmanCmd} info`, { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  startMachine(): boolean {
    if (this.podmanCmd === null) return false
    try {
      execSync(`${this.podmanCmd} machine start`, { stdio: 'inherit' })
      return true
    } catch {
      return false
    }
  }

  checkResources() {
    try {
      const info = execSync(`${this.podmanCmd} system info --format json`, {
        stdio: 'pipe',
      }).toString()
      const systemInfo = JSON.parse(info)

      const cpus = systemInfo.host?.cpus || 0
      const memoryBytes = systemInfo.host?.memFree || 0
      const memoryGb = Math.round((memoryBytes / (1024 * 1024 * 1024)) * 100) / 100

      return { cpus: cpus as number, memoryGb: memoryGb as number }
    } catch {
      return { cpus: 0, memoryGb: 0 }
    }
  }

  getContainers(): string[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execSync(`${this.podmanCmd} ps -a --format "{{.Names}}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      return output.split('\n').filter((name) => name)
    } catch {
      return []
    }
  }

  async composeUp(containerDir: string, rebuild: boolean = false) {
    if (this.podmanCmd === null) return false
    try {
      execSync(`${this.podmanCmd} compose up -d ${rebuild ? '--build' : ''}`, {
        cwd: containerDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      return true
    } catch (error) {
      fatalError(error)
    }
  }

  async composeDown(containerDir: string) {
    if (this.podmanCmd === null) return false
    try {
      execSync(`${this.podmanCmd} compose down`, {
        cwd: containerDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      return true
    } catch (error) {
      fatalError(error)
    }
  }

  getComposeContainerStatuses(projectName: string): ContainerStatus[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execSync(
        `${this.podmanCmd} ps -a --filter label=com.docker.compose.project=${projectName} --format "{{.Names}}\t{{.State}}\t{{.Status}}"`,
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      ).trim()

      if (!output) return []

      return output.split('\n').map((line) => {
        const parts = line.split('\t')
        const name = parts[0] || ''
        const state = parts[1] || 'unknown'
        const status = parts[2] || ''

        // Extract health status from status string (e.g., "Up 2 seconds (healthy)" or "Exited")
        const healthMatch = status.match(/\((.*?)\)/)
        const health = healthMatch ? healthMatch[1] : state

        return { name, status: state, health }
      })
    } catch {
      return []
    }
  }

  async waitForComposeContainers(
    projectName: string,
    timeoutMs: number = 600000,
    intervalMs: number = 5000,
  ): Promise<void> {
    if (this.podmanCmd === null) {
      throw new Error('Podman is not installed')
    }

    const startTime = Date.now()
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let frameIndex = 0

    return new Promise((resolve, reject) => {
      const check = () => {
        const elapsed = Date.now() - startTime
        if (elapsed > timeoutMs) {
          process.stdout.write('\n')
          reject(new Error(`Timeout waiting for containers to be ready`))
          return
        }

        const containers = this.getComposeContainerStatuses(projectName)

        if (containers.length === 0) {
          const spinner = spinnerFrames[frameIndex % spinnerFrames.length]
          frameIndex++
          process.stdout.write(`\r${spinner} Waiting for containers...`)
          setTimeout(check, intervalMs)
          return
        }

        // Check if all containers are healthy/running
        const allHealthy = containers.every((c) => {
          const healthLower = c.health.toLowerCase()
          return healthLower === 'healthy' || healthLower === 'running'
        })

        const elapsedMin = Math.floor(elapsed / 60000)
        const elapsedSec = Math.floor((elapsed % 60000) / 1000)
        const timeStr = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`

        if (allHealthy) {
          // Clear and show final status
          process.stdout.write('\r' + ' '.repeat(150) + '\r')
          containers.forEach((c) => {
            logger.info(`✓ ${c.name}: ${c.health.toUpperCase()}`)
          })
          resolve()
          return
        }

        // Display current status of all containers
        const spinner = spinnerFrames[frameIndex % spinnerFrames.length]
        frameIndex++
        const statusLine = containers.map((c) => `${c.name} ${c.health.toUpperCase()}`).join(' | ')
        process.stdout.write(`\r${spinner} ${statusLine} (${timeStr})    `)

        setTimeout(check, intervalMs)
      }

      check()
    })
  }

  /*
  getRunningDatabaseContainers(): string[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execSync(`${this.podmanCmd} ps --format "{{.Names}}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      return output.split('\n').filter((name) => name)
    } catch {
      return []
    }
  }

  containerExists(containerName: string): boolean {
    const containers = this.getDatabaseContainers()
    return containers.includes(containerName)
  }

  containerRunning(containerName: string): boolean {
    const runningContainers = this.getRunningDatabaseContainers()
    return runningContainers.includes(containerName)
  }

  getContainerPorts(): string[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execSync(`${this.podmanCmd} ps -a --format "{{.Names}}|{{.Ports}}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      const lines = output.trim().split('\n')
      const portsSet = new Set<string>()

      lines.forEach((line) => {
        if (!line) return
        const parts = line.split('|')
        if (parts.length >= 2) {
          const portsStr = parts[1]?.trim()

          if (portsStr && portsStr !== '<none>') {
            // Parse port bindings like "127.0.0.1:1521->1521/tcp, 127.0.0.1:5500->5500/tcp"
            const ports = portsStr
              .split(',')
              .map((p) => {
                const match = p.trim().match(/->(\d+)/)
                return match ? match[1] : null
              })
              .filter((p) => p !== null) as string[]

            ports.forEach((port) => portsSet.add(port))
          }
        }
      })
      return Array.from(portsSet).toSorted((a, b) => parseInt(a) - parseInt(b))
    } catch {
      return []
    }
  }

  getRunningContainerPorts(): string[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execSync(`${this.podmanCmd} ps --format "{{.Names}}|{{.Ports}}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      })
      const lines = output.trim().split('\n')
      const portsSet = new Set<string>()

      lines.forEach((line) => {
        if (!line) return
        const parts = line.split('|')
        if (parts.length >= 2) {
          const portsStr = parts[1]?.trim()

          if (portsStr && portsStr !== '<none>') {
            // Parse port bindings like "127.0.0.1:1521->1521/tcp, 127.0.0.1:5500->5500/tcp"
            const ports = portsStr
              .split(',')
              .map((p) => {
                const match = p.trim().match(/->(\d+)/)
                return match ? match[1] : null
              })
              .filter((p) => p !== null) as string[]

            ports.forEach((port) => portsSet.add(port))
          }
        }
      })
      return Array.from(portsSet).toSorted((a, b) => parseInt(a) - parseInt(b))
    } catch {
      return []
    }
  }
  */

  async createContainer(containerDir: string) {
    if (this.podmanCmd === null) return false
    try {
      execSync(`${this.podmanCmd} compose up -d --build`, {
        cwd: containerDir,
        stdio: 'inherit',
      })

      return true
    } catch (error) {
      fatalError(error)
    }
  }

  async startContainer(containerName: string) {
    if (this.podmanCmd === null) {
      return false
    }
    try {
      execSync(`${this.podmanCmd} start ${containerName}`, { stdio: 'pipe' })
    } catch (error) {
      fatalError(error)
    }

    try {
      await this.waitForContainerHealth(containerName)
    } catch (error) {
      fatalError(error)
    }
    return true
  }

  /*
  stopContainer(containerName: string): boolean {
    if (this.podmanCmd === null) {
      return false
    }
    try {
      execSync(`${this.podmanCmd} stop ${containerName}`, { stdio: 'pipe' })

      return true
    } catch (error) {
      return false
    }
  }

  removeContainer(containerName: string): boolean {
    if (this.podmanCmd === null) {
      return false
    }
    try {
      execSync(`${this.podmanCmd} rm ${containerName}`, { stdio: 'pipe' })

      return true
    } catch (error) {
      return false
    }
  }
*/
  async downloadDbWalletZip(containerName: string, outputZipPath: string): Promise<void> {
    if (this.podmanCmd === null) {
      throw new Error('Podman is not installed')
    }
    mkdirSync(path.dirname(outputZipPath), { recursive: true })

    const zipCommand = [
      'set -euo pipefail',
      'cd /u01/app/oracle/wallets/tls_wallet',
      'shopt -s dotglob',
      'zip -r -X -q - *',
    ].join(' && ')

    await new Promise<void>((resolve, reject) => {
      const child = spawn(this.podmanCmd!, ['exec', containerName, 'bash', '-lc', zipCommand], {
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

  async waitForContainerHealth(
    containerName: string,
    timeoutMs: number = 600000,
    intervalMs: number = 5000,
  ): Promise<void> {
    if (this.podmanCmd === null) {
      throw new Error('Podman is not installed')
    }
    const startTime = Date.now()
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let frameIndex = 0

    const getContainerStatus = (): string | null => {
      try {
        const result = execSync(
          `${this.podmanCmd!} inspect --format "{{.State.Health.Status}}" ${containerName}`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim()
        return result
      } catch {
        // Container might not exist yet or no health check defined
        try {
          const running = execSync(
            `${this.podmanCmd!} inspect --format "{{.State.Running}}" ${containerName}`,
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
          process.stdout.write('\n')
          reject(new Error(`Timeout waiting for container ${containerName} to be healthy`))
          return
        }

        const status = getContainerStatus()
        const elapsedMin = Math.floor(elapsed / 60000)
        const elapsedSec = Math.floor((elapsed % 60000) / 1000)
        const timeStr = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`

        if (status === 'healthy') {
          process.stdout.write('\r' + ' '.repeat(80) + '\r') // Clear line
          resolve()
          return
        }

        const spinner = spinnerFrames[frameIndex % spinnerFrames.length]
        frameIndex++
        const statusDisplay = status ?? 'waiting'
        process.stdout.write(
          `\r${spinner} Waiting for database to be ready... (${statusDisplay}, ${timeStr})`,
        )

        setTimeout(check, intervalMs)
      }

      check()
    })
  }
}
