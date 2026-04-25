import prompts from 'prompts'
import path from 'path'
import { configDir } from '../utils/index.js'
import { logger } from '../utils/logger.js'
import { Config } from '../utils/config.js'
import { EnvFile } from '../utils/envFile.js'

const passwordValidation = (value: string) => {
  if (!value.trim()) return 'This field is required'
  if (value.length < 12) return 'Password must be at least 12 characters'
  if (!/[A-Z]/.test(value)) return 'Password must contain at least one uppercase letter'
  if (!/[a-z]/.test(value)) return 'Password must contain at least one lowercase letter'
  if (!/[0-9]/.test(value)) return 'Password must contain at least one digit'
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value))
    return 'Password must contain at least one special character'
  if (/password|admin/i.test(value))
    return 'Password may not contain "Password" or "Admin" fragments'
  return true
}

const initialPassword = `MySecurePass123!`

export const runSetupAdb = async () => {
  logger.info('Setting up database...')

  const config = new Config()
  const platforms = config.getPlatforms()
  const choices = [
    { title: 'Local', value: 'local' },
    { title: 'Oracle Cloud Infrastructure', value: 'oci' },
  ].filter((option) => platforms.some((p) => p.platform === option.value))

  const dbConfig = await prompts([
    {
      type: 'text',
      name: 'dbName',
      message: 'Database name',
      initial: `${config.getProjectName()}-adb`,
      validate: (value) => (value.trim() ? true : 'This field is required'),
    },
    {
      type: choices.length > 1 ? 'select' : null,
      name: 'deploymentType',
      message: 'Deployment type',
      choices,
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
    {
      type: 'password',
      name: 'adminPassword',
      message: 'Admin password',
      initial: initialPassword,
      validate: passwordValidation,
    },
    {
      type: 'password',
      name: 'walletPassword',
      message: 'Wallet password',
      initial: initialPassword,
      validate: passwordValidation,
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
      logger.error('Setup cancelled')
      logger.lf()
      process.exit(0)
    }
  }

  const spec =
    dbConfig.deploymentType === 'local'
      ? {
          listenerPort: dbConfig.listenerPort,
          ordsPort: dbConfig.ordsPort,
        }
      : {
          dbWorkload: 'OLTP',
          isFreeTier: true,
          isMtlsConnectionRequired: true,
        }

  config.addResource({
    name: dbConfig.dbName,
    type: 'adb',
    platform: dbConfig.deploymentType || choices[0]?.value,
    spec,
  })

  const envFilePath = path.resolve(configDir, config.getCurrentEnvironment() || '', '.env')
  const envFile = new EnvFile(envFilePath)
  envFile.set('ODBVUE_ADMIN_PASSWORD', dbConfig.adminPassword)
  envFile.set('ODBVUE_WALLET_PASSWORD', dbConfig.walletPassword)

  logger.lf()
}
