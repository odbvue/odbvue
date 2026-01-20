import { Command } from 'commander'
import { logger, rootDir, path, spawn, chalk } from '../utils.js'

interface ProcessData {
  name: string
  command: string
  args: string[]
  process?: ReturnType<typeof spawn>
  output: string[]
  status: 'starting' | 'running' | 'error'
  url?: string
  port?: number
  errorMessage?: string
}

export const registerDevCommand = (program: Command) => {
  program
    .command('dev')
    .description('Start all development servers (app, wiki) in parallel')
    .option('--no-wiki', 'Skip running wiki dev server')
    .option('-a, --all', 'Show all output from all processes simultaneously')
    .action((options: { wiki: boolean; all: boolean }) => {
      const appsDir = path.resolve(rootDir, 'apps')

      const processesData: ProcessData[] = []
      let currentPage = 0 // 0 = summary, 1+ = process output
      let isShuttingDown = false

      const spawnProcess = (processData: ProcessData) => {
        logger.info(`Starting ${processData.name}...`)
        processData.status = 'starting'

        const child = spawn(processData.command, processData.args, {
          cwd: appsDir,
          stdio: options.all ? 'inherit' : ['ignore', 'pipe', 'pipe'],
          shell: true,
        })

        processData.process = child

        if (!options.all) {
          const handleData = (data: Buffer) => {
            const text = data.toString()
            processData.output.push(text)

            // Keep only last 100 lines to avoid memory issues
            if (processData.output.length > 100) {
              processData.output.shift()
            }

            // Extract URL from output if found
            if (text.includes('Local') && text.includes('http://localhost:')) {
              processData.url = 'http://localhost:' + text.split(':')[3].trim()
            }

            // Detect when service is running with multiple indicators
            if (processData.status === 'starting') {
              const lowerText = text.toLowerCase()

              // More specific indicators for each service
              const isRunning =
                lowerText.includes('local:') || lowerText.includes('http://localhost')

              if (isRunning) {
                processData.status = 'running'
              }

              // Check for actual errors to set error status
              if (lowerText.includes('error')) {
                processData.status = 'error'
              }
            }
          }

          child.stdout?.on('data', handleData)
          child.stderr?.on('data', handleData)

          child.on('error', (error) => {
            processData.status = 'error'
            processData.errorMessage = error.message
            processData.output.push(chalk.red(`ERROR: ${error.message}`))
          })
        }

        child.on('exit', (code) => {
          if (code !== 0 && code !== null && !isShuttingDown) {
            processData.status = 'error'
            processData.errorMessage = `Exited with code ${code}`
          }
        })
      }

      const displaySummary = () => {
        console.clear()
        console.log(chalk.cyan(`\n  OdbVue Development Environment Dashboard\n`))
        console.log(`  ─────────────────────────────────────────────\n`)

        console.log(chalk.bold(`  Services:\n`))

        processesData.forEach((proc, index) => {
          const statusIcon =
            proc.status === 'running'
              ? chalk.green('●')
              : proc.status === 'error'
                ? chalk.red('●')
                : chalk.yellow('●')
          const statusText =
            proc.status === 'running'
              ? chalk.green('RUNNING')
              : proc.status === 'error'
                ? chalk.red('ERROR')
                : chalk.yellow('STARTING')

          console.log(`  ${statusIcon} [${index + 2}] ${proc.name.padEnd(15)} ${statusText}`)

          if (proc.url) {
            console.log(chalk.gray(`     └─ `) + chalk.blue.underline(proc.url))
          }

          if (proc.status === 'error' && proc.errorMessage) {
            console.log(chalk.red(`     └─ Error: ${proc.errorMessage}`))
          }

          console.log()
        })

        console.log(`  ─────────────────────────────────────────────`)
        console.log(chalk.gray(`  [1] Summary (this page)`))
        processesData.forEach((_, index) => {
          console.log(chalk.gray(`  [${index + 2}] ${processesData[index].name} output`))
        })
        console.log(chalk.gray(`  [q] Quit\n`))
      }

      const displayProcessOutput = (processIndex: number) => {
        if (processIndex < 0 || processIndex >= processesData.length) {
          return
        }

        console.clear()

        const proc = processesData[processIndex]
        console.log(`\n  ${proc.name}`)

        const statusIcon =
          proc.status === 'running'
            ? chalk.green('●')
            : proc.status === 'error'
              ? chalk.red('●')
              : chalk.yellow('●')
        const statusText =
          proc.status === 'running'
            ? chalk.green('RUNNING')
            : proc.status === 'error'
              ? chalk.red('ERROR')
              : chalk.yellow('STARTING')

        console.log(`  Status: ${statusIcon} ${statusText}\n`)
        console.log(`  ─────────────────────────────────────────────\n`)

        if (proc.output.length === 0) {
          console.log(chalk.gray('  (waiting for output...)\n'))
        } else {
          const lastLines = proc.output.slice(-30).join('')
          console.log(lastLines)
        }

        console.log(`\n  ─────────────────────────────────────────────`)
        console.log(chalk.gray(`  [1] Summary | [2-4] Other processes | [q] Quit\n`))
      }

      try {
        // Initialize processes
        processesData.push({
          name: 'App Dev',
          command: 'pnpm',
          args: ['dev'],
          output: [],
          status: 'starting',
          url: 'http://localhost:5173',
        })

        if (options.wiki) {
          processesData.push({
            name: 'Wiki Dev',
            command: 'pnpm',
            args: ['wiki:dev'],
            output: [],
            status: 'starting',
            url: 'http://localhost:5174',
          })
        }

        // Start all processes
        processesData.forEach((p) => spawnProcess(p))

        logger.success(`Development environment started with ${processesData.length} process(es).`)

        if (!options.all) {
          // Set up interactive keyboard controls
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(true)
            process.stdin.resume()
            process.stdin.setEncoding('utf-8')

            process.stdin.on('data', (key: string) => {
              if (key === 'q' || key === 'Q') {
                shutdown()
              } else if (key >= '1' && key <= '9') {
                const pageNum = parseInt(key, 10)
                if (pageNum === 1) {
                  currentPage = 0
                  displaySummary()
                } else if (pageNum - 2 < processesData.length) {
                  currentPage = pageNum - 1
                  displayProcessOutput(pageNum - 2)
                }
              }
            })

            displaySummary()

            // Refresh display every 1000ms
            setInterval(() => {
              if (currentPage === 0) {
                displaySummary()
              } else {
                displayProcessOutput(currentPage - 1)
              }
            }, 1000)
          }
        }

        // Handle graceful shutdown
        const shutdown = () => {
          isShuttingDown = true

          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false)
          }

          logger.info('Shutting down processes...')
          const killPromises = processesData.map(
            ({ name, process: proc }) =>
              new Promise<void>((resolve) => {
                if (proc && !proc.killed) {
                  logger.info(`Stopping ${name}...`)
                  proc.kill('SIGTERM')

                  const killTimeout = setTimeout(() => {
                    if (proc && !proc.killed) {
                      logger.warn(`Force killing ${name}...`)
                      proc.kill('SIGKILL')
                    }
                    resolve()
                  }, 5000)

                  proc.on('exit', () => {
                    clearTimeout(killTimeout)
                    resolve()
                  })
                } else {
                  resolve()
                }
              }),
          )

          Promise.all(killPromises).then(() => {
            logger.success('All processes stopped')
            process.exit(0)
          })
        }

        process.on('SIGINT', shutdown)
        process.on('SIGTERM', shutdown)
      } catch (error) {
        logger.error(`Failed to start development environment: ${error}`)
        processesData.forEach(({ process: proc }) => {
          if (proc && !proc.killed) {
            proc.kill()
          }
        })
        process.exit(1)
      }
    })
}
