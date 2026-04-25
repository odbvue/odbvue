import prompts from 'prompts'
import { logger } from '../utils/logger.js'
import { Config } from '../utils/config.js'

const CREATE_NEW = '__create_new'

export const runSetupEnvironment = async () => {
  logger.info('Setting up project...')

  const config = new Config()

  const projectName = await prompts({
    type: 'text',
    name: 'value',
    message: 'Project name',
    initial: config.getProjectName() || 'odbvue',
    validate: (value) => (value.trim() ? true : 'This field is required'),
  })
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
      ? (
          await prompts({
            type: 'text',
            name: 'value',
            message: 'Environment name',
            validate: (value) => (value.trim() ? true : 'This field is required'),
          })
        ).value.trim()
      : environment

  config.setCurrentEnvironment(environmentName)
  logger.lf()
}
