import { execFileSync } from 'child_process'
import { spawn } from 'child_process'
import { mkdirSync, createWriteStream } from 'fs'
import { platform } from 'os'
import path from 'path'

import { logger } from '../shared/logger.js'

export interface ContainerStatus {
  name: string
  state: string
  status: string
  healthy: boolean
  ports: string[]
}

export class PodmanClient {
  private podmanCmd: string | null

  tryExec = (command: string, args: string[] = [], cwd?: string): boolean => {
    try {
      execFileSync(command, args, {
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
      if (this.tryExec('podman.exe', ['--version'])) {
        this.podmanCmd = 'podman.exe'
      }
    }
    if (this.tryExec('podman', ['--version'])) {
      this.podmanCmd = 'podman'
    }
  }

  isInstalled(): boolean {
    if (this.podmanCmd === null) return false
    return this.tryExec(this.podmanCmd, ['--version'])
  }

  isRunning(): boolean {
    if (this.podmanCmd === null) return false
    try {
      execFileSync(this.podmanCmd, ['info'], { stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  startMachine(): boolean {
    if (this.podmanCmd === null) return false
    try {
      execFileSync(this.podmanCmd, ['machine', 'start'], { stdio: 'inherit' })
      return true
    } catch {
      return false
    }
  }

  checkResources() {
    if (this.podmanCmd === null) return { cpus: 0, memoryGb: 0 }
    try {
      const info = execFileSync(this.podmanCmd, ['system', 'info', '--format', 'json'], {
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
      const output = execFileSync(this.podmanCmd, ['ps', '-a', '--format', '{{.Names}}'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      return output.split('\n').filter((name) => name)
    } catch {
      return []
    }
  }

  async composeUp(containerDir: string, forceRecreate: boolean = false) {
    if (this.podmanCmd === null) return false
    try {
      execFileSync(
        this.podmanCmd,
        [
          'compose',
          '-f',
          'podman-compose.yaml',
          'up',
          '-d',
          ...(forceRecreate ? ['--force-recreate'] : []),
        ],
        {
          cwd: containerDir,
          stdio: 'inherit',
        },
      )

      return true
    } catch (error) {
      logger.fatal(error)
    }
  }

  async composeDown(containerDir: string) {
    if (this.podmanCmd === null) return false
    try {
      execFileSync(this.podmanCmd, ['compose', '-f', 'podman-compose.yaml', 'down'], {
        cwd: containerDir,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      return true
    } catch {
      return false
    }
  }

  startContainer(containerName: string): boolean {
    if (this.podmanCmd === null) {
      return false
    }
    try {
      execFileSync(this.podmanCmd, ['start', containerName], { stdio: 'pipe' })
    } catch (error) {
      logger.fatal(error)
    }

    return true
  }

  getContainerStatuses(): ContainerStatus[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execFileSync(
        this.podmanCmd,
        ['ps', '-a', '--format', '{{.Names}}\t{{.State}}\t{{.Status}}\t{{.Ports}}'],
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
        const portsStr = parts[3] || ''

        const healthMatch = status.match(/\((.*?)\)/)
        const healthy = healthMatch ? healthMatch[1].toLowerCase() === 'healthy' : false

        const ports: string[] = []
        if (portsStr && portsStr !== '<none>') {
          const portMatches = portsStr.split(',').map((p) => {
            const match = p.trim().match(/->(\d+)/)
            return match ? match[1] : null
          })
          ports.push(...(portMatches.filter((p) => p !== null) as string[]))
        }

        return { name, state, status, healthy, ports }
      })
    } catch {
      return []
    }
  }

  getContainerPorts(includeAll: boolean = false): string[] {
    if (this.podmanCmd === null) {
      return []
    }
    try {
      const output = execFileSync(
        this.podmanCmd,
        ['ps', ...(includeAll ? ['-a'] : []), '--format', '{{.Names}}|{{.Ports}}'],
        {
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      )
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

  private async waitForReadiness(
    getState: () => unknown,
    isReady: (state: unknown) => boolean,
    displayStatus: (state: unknown, elapsed: number, spinner: string) => void,
    onReady?: (state: unknown) => void,
    errorMessage: string = 'Timeout waiting for readiness',
    timeoutMs: number = 600000,
    intervalMs: number = 5000,
  ): Promise<void> {
    const startTime = Date.now()
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    let frameIndex = 0

    return new Promise((resolve, reject) => {
      const check = () => {
        const elapsed = Date.now() - startTime
        if (elapsed > timeoutMs) {
          process.stdout.write('\n')
          reject(new Error(errorMessage))
          return
        }

        const state = getState()

        if (isReady(state)) {
          process.stdout.write('\r' + ' '.repeat(150) + '\r')
          onReady?.(state)
          resolve()
          return
        }

        const spinner = spinnerFrames[frameIndex % spinnerFrames.length]
        frameIndex++
        displayStatus(state, elapsed, spinner)

        setTimeout(check, intervalMs)
      }

      check()
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

    const getContainerStatus = (): string | null => {
      try {
        const result = execFileSync(
          this.podmanCmd!,
          ['inspect', '--format', '{{.State.Health.Status}}', containerName],
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim()
        return result
      } catch {
        // Container might not exist yet or no health check defined
        try {
          const running = execFileSync(
            this.podmanCmd!,
            ['inspect', '--format', '{{.State.Running}}', containerName],
            { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
          ).trim()
          return running === 'true' ? 'running' : 'not-running'
        } catch {
          return null
        }
      }
    }

    await this.waitForReadiness(
      getContainerStatus,
      (status) => status === 'healthy',
      (status, elapsed, spinner) => {
        const elapsedMin = Math.floor(elapsed / 60000)
        const elapsedSec = Math.floor((elapsed % 60000) / 1000)
        const timeStr = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`
        const statusDisplay = (status as string | null) ?? 'waiting'
        process.stdout.write(
          `\r${spinner} Waiting for database to be ready... (${statusDisplay}, ${timeStr})`,
        )
      },
      undefined,
      `Timeout waiting for container ${containerName} to be healthy`,
      timeoutMs,
      intervalMs,
    )
  }

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
}
