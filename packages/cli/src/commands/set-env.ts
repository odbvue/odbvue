import { Command } from 'commander'
import prompts from 'prompts'

import { EnvironmentStore } from '../adapters/environment-store.js'

export const registerSetEnvCommand = (program: Command) => {
  program
    .command('set-env')
    .alias('se')
    .description('Set current environment')
    .action(async () => {
      const environmentStore = new EnvironmentStore()
      const environments = environmentStore
        .getAvailable()
        .map((env) => ({ title: env, value: env }))

      const { environment } = await prompts([
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

      environmentStore.setCurrent(environmentStore.getCurrent().projectName, environment)
      console.log('')
    })
}
