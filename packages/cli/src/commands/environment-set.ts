import { Command } from 'commander'
import prompts from 'prompts'

import { EnvironmentStore } from '../adapters/environment-store.js'

export const registerEnvironmentSetCommand = (program: Command) => {
  program
    .command('environment-set')
    .alias('es')
    .description('Set current environment')
    .argument('[environment]', 'Environment name (optional)')
    .action(async (environmentArg) => {
      const environmentStore = new EnvironmentStore()
      const availableEnvironments = environmentStore.getAvailable()
      const environments = availableEnvironments.map((env) => ({ title: env, value: env }))

      let environment = environmentArg

      if (environment && availableEnvironments.includes(environment)) {
        environmentStore.setCurrent(environmentStore.getCurrent().projectName, environment)
        return
      }

      const { environment: selectedEnv } = await prompts([
        {
          type: 'select',
          name: 'environment',
          message: 'Environment',
          choices: environments,
          initial: environments.findIndex(
            (e) => e.value === environmentStore.getCurrent().currentEnv,
          ),
        },
      ])

      environmentStore.setCurrent(environmentStore.getCurrent().projectName, selectedEnv)
      console.log('')
    })
}
