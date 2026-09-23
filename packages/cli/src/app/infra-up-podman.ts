import prompts from 'prompts'
import path from 'path'

import { logger } from '../shared/logger.js'
import { YamlFile } from '../shared/yamlFile.js'
import { unZip } from '../shared/zip.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

const composeFile = 'podman-compose.yaml'

export const runInfraUpPodman = async () => {
  const { projectName, currentEnv, envDir } = new EnvironmentStore().getCurrent()
  const projectNameWithEnv = `${projectName}-${currentEnv}`

  const config = new ConfigStore()
  if (!config.getConfig().platforms.some((p) => p.platform === 'local-podman')) return

  logger.info('Starting local ADB...')
  const podman = new PodmanClient()

  if (!podman.isInstalled()) {
    logger.fatal('Podman is not installed. Please install Podman to continue.')
  } else logger.muted('Podman is installed...')

  if (!podman.isRunning()) {
    if (!podman.startMachine()) {
      logger.fatal('Failed to start Podman.')
    }
  } else logger.muted('Podman is running...')

  const localAdbServices = config
    .getConfig()
    .services.filter(
      (service) => service.kind === 'oracle-adb' && service.platform === 'local-podman',
    )
  if (localAdbServices.length === 0) return
  if (localAdbServices.length !== 1) {
    throw new Error('Local Podman supports exactly one ADB service.')
  }
  const service = localAdbServices[0]

  const existing = podman
    .getContainerStatuses()
    .find((container) => container.name === service.service)
  let action: 'create' | 'use-existing' | 'recreate' = 'create'
  if (existing) {
    const { action: selectedAction } = await prompts({
      type: 'select',
      name: 'action',
      message: `Container "${service.service}" already exists (${existing.status})`,
      choices: [
        {
          title:
            existing.state === 'running' ? 'Use existing container' : 'Start existing container',
          value: 'use-existing',
        },
        { title: 'Recreate container', value: 'recreate' },
        { title: 'Exit', value: 'exit' },
      ],
    })
    if (selectedAction !== 'use-existing' && selectedAction !== 'recreate') return false
    action = selectedAction
  }
  if (action === 'use-existing') {
    if (existing?.state !== 'running' && !podman.startContainer(service.service)) {
      throw new Error(`Failed to start ADB container "${service.service}".`)
    }
    logger.info(`Using existing local ADB container "${service.service}".`)
  } else {
    new YamlFile(path.resolve(envDir, composeFile)).set({
      name: projectNameWithEnv,
      services: {
        'oracle-adb': {
          image: 'container-registry.oracle.com/database/adb-free:latest',
          container_name: service.service,
          ports: [`${service.spec.listenerPort}:1522`, `${service.spec.ordsPort}:8443`],
          environment: {
            WORKLOAD_TYPE: 'ATP',
            ADMIN_PASSWORD: '${ODBVUE_ADB_ADMIN_PASSWORD}',
            WALLET_PASSWORD: '${ODBVUE_ADB_WALLET_PASSWORD}',
          },
          cap_add: ['SYS_ADMIN'],
          devices: ['/dev/fuse:/dev/fuse'],
        },
      },
    })
    logger.info(`Reconciling local ADB container "${service.service}"...`)
    await podman.composeUp(envDir, action === 'recreate')
  }
  await podman.waitForContainerHealth(service.service, 3600000)

  const container = podman.getContainerStatuses().find((item) => item.name === service.service)
  if (!container?.healthy) throw new Error(`ADB container "${service.service}" is not healthy.`)
  const walletPath = path.join(envDir, '.wallets', `${container.name}.zip`)
  await podman.downloadDbWalletZip(container.name, walletPath)
  await unZip(walletPath, path.join(envDir, '.wallets', container.name))

  logger.success(
    `${container.name} is up and running (${container.state}, ${container.status}) [${container.ports.join(', ')}]`,
  )
  logger.lf()
}
