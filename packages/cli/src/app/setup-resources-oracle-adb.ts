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
    const ports = podmanClient.getContainerPorts()

    const { dbName, listenerPort, ordsPort } = await prompts([
      {
        type: 'text',
        name: 'dbName',
        message: 'Database name',
        initial: `${projectName}-adb`,
        validate: (value) => containerNameValidation(value, containers),
      },
      {
        type: 'text',
        name: 'listenerPort',
        message: 'Listener Port',
        initial: '1522',
        validate: (value) => containerPortValidation(value, ports),
      },
      {
        type: 'text',
        name: 'ordsPort',
        message: 'ORDS Port',
        initial: '8443',
        validate: (value) => containerPortValidation(value, ports),
      },
    ])

    config.addService({
      service: dbName,
      kind: 'oracle-adb',
      platform: 'local-podman',
      spec: {
        listenerPort,
        ordsPort,
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
  ])

  const secretsStore = new SecretsStore()
  secretsStore.set('ODBVUE_ADMIN_PASSWORD', credentials.adminPassword)
  secretsStore.set('ODBVUE_WALLET_PASSWORD', credentials.walletPassword)

  logger.lf()
}
