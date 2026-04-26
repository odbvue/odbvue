import prompts from 'prompts'

import { logger } from '../shared/logger.js'

import { EnvironmentStore } from '../adapters/environment-store.js'

const CREATE_NEW = '__create_new'

export const runSetupEnvironment = async () => {
  logger.info('Setting up project environment...')

  const environmentStore = new EnvironmentStore()

  const projectName = await prompts({
    type: 'text',
    name: 'value',
    message: 'Project name',
    initial: environmentStore.getCurrent().projectName,
    validate: (value) => (value.trim() ? true : 'This field is required'),
  })
  environmentStore.setCurrent(projectName.value, environmentStore.getCurrent().currentEnv)

  const environments = [
    ...environmentStore.getAvailable().map((env) => ({ title: env, value: env })),
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

  environmentStore.setCurrent(environmentStore.getCurrent().projectName, environmentName)
  logger.lf()
}
