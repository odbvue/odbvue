import { Command } from 'commander'
import prompts from 'prompts'
import { logger } from '../utils/logger.js'
import { Config } from '../utils/config.js'

export const runDbCreate = async () => {
  logger.info('Setting up database...')

  const config = new Config()
  const dbConfig = await prompts([
    {
      type: 'text',
      name: 'dbName',
      message: 'Database name',
      initial: `${config.getProjectName()}-adb-${config.getCurrentEnvironment()}`,
      validate: (value) => (value.trim() ? true : 'This field is required'),
    },
    {
      type: 'select',
      name: 'deploymentType',
      message: 'Deployment type',
      choices: [
        { title: 'Local', value: 'local' },
        { title: 'Oracle Cloud Infrastructure', value: 'oci' },
      ],
    },
    {
      type: (_prev, values) => (values.deploymentType === 'local' ? 'text' : null),
      name: 'listenerPort',
      message: 'Listener Port',
      initial: '1522',
      validate: (value) => (value.trim() ? true : 'This field is required'),
    },
    {
      type: (_prev, values) => (values.deploymentType === 'local' ? 'text' : null),
      name: 'ordsPort',
      message: 'ORDS Port',
      initial: '8443',
    },
  ])

  const existingResource = config.getResources().find((r) => r.name === dbConfig.dbName)
  if (existingResource) {
    const { confirm } = await prompts({
      type: 'confirm',
      name: 'confirm',
      message: `Resource "${dbConfig.dbName}" already exists. Overwrite?`,
      initial: false,
    })
    if (!confirm) {
      logger.info('Cancelled')
      return
    }
  }

  config.addResource({
    name: dbConfig.dbName,
    type: 'adb',
    provider: dbConfig.deploymentType,
    options: {
      listenerPort: dbConfig.listenerPort,
      ordsPort: dbConfig.ordsPort,
    },
  })

  logger.lf()
}

export const registerDbCreateCommand = (program: Command) => {
  program.command('db-create').alias('dc').description('Create database').action(runDbCreate)
}
