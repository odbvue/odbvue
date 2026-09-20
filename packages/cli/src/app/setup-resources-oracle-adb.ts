import prompts from 'prompts'
import path from 'path'

import { logger } from '../shared/logger.js'

import { PodmanClient } from '../adapters/podman-client.js'
import { OciClient } from '../adapters/oci-client.js'
import { EnvironmentStore } from '../adapters/environment-store.js'
import { availablePlatforms, ConfigStore } from '../adapters/config-store.js'
import { SecretsStore } from '../adapters/secrets-store.js'

import { INITIAL_PASSWORD } from '../shared/const.js'

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

const containerNameValidation = (value: string, containers: string[]) => {
  if (!value.trim()) return 'This field is required'
  if (containers.includes(value)) return `Container with name "${value}" already exists`
  return true
}

const containerPortValidation = (value: string, ports: string[]) => {
  if (!value.trim()) return 'This field is required'
  const port = Number(value)
  if (isNaN(port) || port < 1 || port > 65535) return 'Please enter a valid port number (1-65535)'
  if (ports.includes(value)) return `Port "${value}" is already in use`
  return true
}

const ociValidation = async (value: string, adbInstances: string[]) => {
  if (!value.trim()) return 'This field is required'
  if (adbInstances.some((adb) => adb === value))
    return `ADB instance with name "${value}" already exists in OCI`
  return true
}

export const runSetupOracleAdb = async () => {
  logger.info('Setting up Oracle Database...')

  const { projectName, envDir } = new EnvironmentStore().getCurrent()

  const config = new ConfigStore()
  const platforms = config.getPlatforms()
  const choices = availablePlatforms.filter((option) => platforms.some((p) => p === option.value))

  const { deploymentType } =
    choices.length == 1
      ? { deploymentType: choices[0].value }
      : await prompts([
          {
            type: choices.length > 1 ? 'select' : null,
            name: 'deploymentType',
            message: 'Deployment type',
            choices,
          },
        ])

  if (deploymentType === 'local-podman') {
    const podmanClient = new PodmanClient()
    const containers = podmanClient.getContainers()
    let ports = podmanClient.getContainerPorts()

    const { dbName: requestedDbName } = await prompts({
      type: 'text',
      name: 'dbName',
      message: 'Database name',
      initial: `${projectName}-adb`,
      validate: (value) => (value.trim() ? true : 'This field is required'),
    })

    let dbName = requestedDbName.trim()
    let reuseExisting = false
    if (containers.includes(dbName)) {
      const { existingContainerAction } = await prompts({
        type: 'select',
        name: 'existingContainerAction',
        message: `Container "${dbName}" already exists`,
        choices: [
          { title: 'Use existing container (keep its port mappings)', value: 'reuse' },
          { title: 'Recreate container', value: 'recreate' },
          { title: 'Use a different name', value: 'rename' },
          { title: 'Exit setup', value: 'exit' },
        ],
      })

      if (existingContainerAction === 'exit') {
        logger.info('Setup cancelled.')
        return
      }

      if (existingContainerAction === 'rename') {
        const response = await prompts({
          type: 'text',
          name: 'dbName',
          message: 'Database name',
          initial: `${dbName}-2`,
          validate: (value) => containerNameValidation(value, containers),
        })
        dbName = response.dbName.trim()
      }

      if (existingContainerAction === 'recreate') {
        podmanClient.stopContainer(dbName)
        if (!podmanClient.removeContainer(dbName)) {
          logger.fatal(`Failed to remove existing container "${dbName}".`)
        }
        ports = podmanClient.getContainerPorts()
      }

      reuseExisting = existingContainerAction === 'reuse'
    }

    const existingService = config
      .getConfig()
      .services.find((service) => service.service === dbName && service.platform === 'local-podman')
    let listenerPort =
      typeof existingService?.spec.listenerPort === 'string'
        ? existingService.spec.listenerPort
        : '1522'
    let ordsPort =
      typeof existingService?.spec.ordsPort === 'string' ? existingService.spec.ordsPort : '8443'

    if (!reuseExisting) {
      const response = await prompts([
        {
          type: 'text',
          name: 'listenerPort',
          message: 'Listener Port',
          initial: listenerPort,
          validate: (value) => containerPortValidation(value, ports),
        },
        {
          type: 'text',
          name: 'ordsPort',
          message: 'ORDS Port',
          initial: ordsPort,
          validate: (value) => containerPortValidation(value, ports),
        },
      ])
      listenerPort = response.listenerPort
      ordsPort = response.ordsPort
    }

    config.addService({
      service: dbName,
      kind: 'oracle-adb',
      platform: 'local-podman',
      spec: {
        listenerPort,
        ordsPort,
        reuseExisting,
      },
    })
  }

  if (deploymentType === 'oci') {
    const ociFilePath = path.join(envDir, '.oci', 'config')
    const profile =
      new ConfigStore().getConfig().platforms.find((p) => p.platform === 'oci')?.spec.profile ||
      'DEFAULT'

    const oci = new OciClient(ociFilePath, profile)
    const adbInstances = (await oci.getAdbInstances()).map((adb) => adb.dbName!)

    const { dbName } = await prompts({
      type: 'text',
      name: 'dbName',
      message: 'Database name',
      initial: `${projectName}-adb`,
      validate: (value) => ociValidation(value, adbInstances),
    })

    config.addService({
      service: dbName,
      kind: 'oracle-adb',
      platform: 'oci',
      spec: {
        dbWorkload: 'OLTP',
        cpuCoreCount: 1,
        dataStorageSizeInTBs: 1,
        isFreeTier: true,
        isMtlsConnectionRequired: true,
      },
    })
  }

  const credentials = await prompts([
    {
      type: 'password',
      name: 'adminPassword',
      message: 'Admin password',
      initial: INITIAL_PASSWORD,
      validate: passwordValidation,
    },
    {
      type: 'password',
      name: 'walletPassword',
      message: 'Wallet password',
      initial: INITIAL_PASSWORD,
      validate: passwordValidation,
    },
    {
      type: 'text',
      name: 'schemaUsername',
      message: 'Schema username',
      initial: `${projectName}`,
      validate: (value) => (value.trim() ? true : 'This field is required'),
    },
    {
      type: 'password',
      name: 'schemaPassword',
      message: 'Schema password',
      initial: INITIAL_PASSWORD,
      validate: passwordValidation,
    },
  ])

  const secretsStore = new SecretsStore()
  secretsStore.set('ODBVUE_ADB_ADMIN_PASSWORD', credentials.adminPassword)
  secretsStore.set('ODBVUE_ADB_WALLET_PASSWORD', credentials.walletPassword)
  secretsStore.set('ODBVUE_ADB_SCHEMA_USERNAME', credentials.schemaUsername)
  secretsStore.set('ODBVUE_ADB_SCHEMA_PASSWORD', credentials.schemaPassword)

  logger.lf()
}
