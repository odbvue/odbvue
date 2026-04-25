import { execSync } from 'child_process'
import { platform } from 'os'

export class PodmanManager {
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
  /*
  getDatabaseContainers(): string[] {
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

  async createContainer(containerDir: string): Promise<boolean> {
    if (this.podmanCmd === null) return false
    try {

      execSync(`${this.podmanCmd} compose up -d --build`, {
        cwd: containerDir,
        stdio: 'inherit',
      })

      return true
    } catch (error) {
      process.exit(1)
    }
  }

  async startContainer(containerName: string): Promise<boolean> {
    if (this.podmanCmd === null) {

      return false
    }
    try {
      execSync(`${this.podmanCmd} start ${containerName}`, { stdio: 'pipe' })
    } catch (error) {

      process.exit(1)
    }

    try {
      await this.waitForContainerHealth(containerName)
  
    } catch (error) {

      process.exit(1)
    }
    return true
  }

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
    */
}
