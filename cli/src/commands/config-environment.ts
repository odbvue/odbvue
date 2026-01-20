import { Command } from 'commander'
import {
  logger,
  chalk,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
} from '../utils.js'
import YAML from 'js-yaml'
import prompts from 'prompts'

export const configEnvironmentAction = async () => {
  logger.info(chalk.bold('Select Environment'))
  logger.msg('')

  const configDir = path.resolve(rootDir, 'config')
  const configYamlPath = path.resolve(configDir, 'config.yaml')

  // Check if config directory exists
  if (!existsSync(configDir)) {
    logger.error(`Config directory not found: ${configDir}`)
    process.exit(1)
  }

  // Check if config.yaml exists
  if (!existsSync(configYamlPath)) {
    logger.error(`Config file not found: ${configYamlPath}`)
    process.exit(1)
  }

  // Read current config
  const configContent = readFileSync(configYamlPath, 'utf-8')
  const config = YAML.load(configContent) as { project?: string; environment?: string }
  const currentEnvironment = config.environment || 'dev'

  // Get list of environment subfolders
  const entries = readdirSync(configDir, { withFileTypes: true })
  const environments = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)

  if (environments.length === 0) {
    logger.error('No environment subfolders found in config directory')
    logger.info('Create an environment first using: ov config-create')
    process.exit(1)
  }

  // Build choices for prompts
  const choices = environments.map((env) => ({
    title: env === currentEnvironment ? `${env} (current)` : env,
    value: env,
  }))

  const currentIndex = environments.indexOf(currentEnvironment)

  const response = await prompts({
    type: 'select',
    name: 'environment',
    message: 'Select environment',
    choices,
    initial: currentIndex >= 0 ? currentIndex : 0,
  })

  // Handle cancellation
  if (!response.environment) {
    logger.warn('Selection cancelled.')
    return
  }

  const selectedEnvironment = response.environment

  // Update config.yaml
  config.environment = selectedEnvironment
  const updatedConfigContent = YAML.dump(config)
  writeFileSync(configYamlPath, updatedConfigContent, 'utf-8')

  logger.success(`Environment changed to: ${selectedEnvironment}`)
}

export const registerConfigEnvironmentCommand = (program: Command) => {
  program
    .command('config-environment')
    .alias('ce')
    .description('Select and set the active environment from available configurations')
    .action(configEnvironmentAction)
}
