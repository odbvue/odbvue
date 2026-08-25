import chalk from 'chalk'

const formatErrorMessage = (msg: unknown): string => {
  if (msg instanceof Error) return msg.message
  if (msg === undefined) return 'Fatal error (undefined)'
  return String(msg)
}

export const logger = {
  success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`ℹ ${msg}`)),
  warn: (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`)),
  msg: (msg: string) => console.log(msg),
  muted: (msg: string) => console.log(chalk.gray(msg)),
  lf: () => console.log(''),
  fatal: (msg?: unknown) => {
    const errorMessage = formatErrorMessage(msg)
    console.error(chalk.red(`✗ ${errorMessage}`))
    console.log('')
    process.exit(1)
  },
}
