import chalk from 'chalk'

const formatErrorMessage = (msg: unknown): string => {
  if (msg instanceof Error) return msg.message
  if (msg === undefined) return 'Fatal error (undefined)'
  return String(msg)
}

export const fatalError = (msg?: unknown) => {
  const errorMessage = formatErrorMessage(msg)
  console.error(chalk.red(`✗ ${errorMessage}`))
  console.log('')
  process.exit(1)
}
