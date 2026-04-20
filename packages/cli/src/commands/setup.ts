import { Command } from 'commander'
import prompts from 'prompts'
import { logger } from '../utils/logger.js'
import { Config } from '../utils/config.js'

import { runDbCreate } from './db-create.js'

const CREATE_NEW = '__create_new'
const validateNotEmpty = (value: string) => (value.trim() ? true : 'This field is required')

const promptText = (message: string, initial?: string) =>
  prompts([
    {
      type: 'text',
      name: 'value',
      message,
      initial,
      validate: validateNotEmpty,
    },
  ])

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description('Initial project setup')
    .action(async () => {
      logger.info('Setting up project...')

      const config = new Config()

      const projectName = await promptText('Project name', config.getProjectName() || 'odbvue')
      config.setProjectName(projectName.value)

      const environments = [
        ...config.listEnvironments().map((env) => ({ title: env, value: env })),
        { title: '+ Create new', value: CREATE_NEW },
      ]

      const { environment } = await prompts([
        { type: 'select', name: 'environment', message: 'Environment', choices: environments },
      ])

      const environmentName =
        environment === CREATE_NEW
          ? (await promptText('Environment name')).value.trim()
          : environment

      config.setCurrentEnvironment(environmentName)
      logger.lf()

      await runDbCreate()
    })
}
