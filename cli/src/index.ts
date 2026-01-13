import chalk from 'chalk'
import prompts from 'prompts'
import { logger } from './utils.js'
import { setupLocalDatabase, removeLocalDatabase } from './db-local.js'

// Main function to handle CLI commands
export async function main(argv = process.argv.slice(2)) {
  const command = argv[0]
  const args = argv.slice(1)

  if (command === 'setup') {
    console.log(
      'Setup OdbVue - a template + reference implementation for building and deploying business-class apps',
    )
    console.log('')

    const response = await prompts({
      type: 'select',
      name: 'setupMode',
      message: 'Choose where to deploy database',
      choices: [
        { title: chalk.gray('Local'), description: 'Podman is required', value: 'local' },
        {
          title: chalk.cyan('Cloud'),
          description: 'Oracle Cloud account is required',
          value: 'cloud',
        },
      ],
      initial: 0,
    })

    if (response.setupMode === 'local') {
      await setupLocalDatabase()
    } else if (response.setupMode === 'cloud') {
      logger.info('Cloud setup coming soon...')
    }

    return
  }

  if (command === 'db-setup-local') {
    await setupLocalDatabase()
    return
  }

  if (command === 'db-remove-local') {
    const containerName = args[0]
    await removeLocalDatabase(containerName)
    return
  }

  logger.info('OdbVue CLI')
  console.log('')
  console.log(chalk.cyan('Available commands:'))
  console.log('')
  console.log(
    chalk.gray('  setup') + chalk.reset('              Interactive setup wizard for OdbVue'),
  )
  console.log(
    chalk.gray('  db-setup-local') +
      chalk.reset('       Setup Oracle Database as Podman container locally'),
  )
  console.log(
    chalk.gray('  db-remove-local [name]') + chalk.reset('  Remove a local database container'),
  )
  console.log('')
  console.log(chalk.cyan('Examples:'))
  console.log('')
  console.log(chalk.gray('  $ ov setup'))
  console.log(chalk.gray('  $ ov db-setup-local'))
  console.log(chalk.gray('  $ ov db-remove-local db-dev'))
  console.log('')
}

main()
