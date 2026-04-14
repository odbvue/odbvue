import { Command } from 'commander'
import prompts from 'prompts'
import { logger } from '../utils/logger.js'
import { Config } from '../utils/config.js'

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description('Initial project setup')
    .action(async () => {
      logger.info('Select environment...')

      const config = new Config()
      const existingEnvironments = config.listEnvironments()
      const choices = [
        ...existingEnvironments.map((env) => ({
          title: env,
          value: env,
        })),
        {
          title: '+ Create new',
          value: '__create_new',
        },
      ]

      const selected = await prompts([
        {
          type: 'select',
          name: 'environment',
          message: 'Environment',
          choices,
          initial: 0,
          validate: (value) => (value ? true : 'Environment selection is required'),
        },
      ])

      let environmentName = selected.environment

      if (environmentName === '__create_new') {
        const newEnv = await prompts([
          {
            type: 'text',
            name: 'name',
            message: 'Environment name',
            validate: (value) => (value.trim() ? true : 'Environment name is required'),
          },
        ])
        environmentName = newEnv.name.trim()
      }

      config.setEnvironment(environmentName)

      logger.lf()
    })
}
