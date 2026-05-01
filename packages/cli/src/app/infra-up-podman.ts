import path from 'path'

import { logger } from '../shared/logger.js'

import { YamlFile } from '../shared/yamlFile.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

export const runInfraUpPodman = async () => {
  const { projectName, currentEnv, envDir } = new EnvironmentStore().getCurrent()
  const projectNameWithEnv = `${projectName}-${currentEnv}`

  const config = new ConfigStore()
  if (!config.getConfig().platforms.some((p) => p.platform === 'local-podman')) return

  logger.info('Starting Local Podman containers...')
  const podman = new PodmanClient()

  let services: Record<string, unknown> = {}
  config.getConfig().services.forEach((service) => {
    if (service.kind === 'oracle-adb') {
      services['oracle-adb'] = {
        image: 'container-registry.oracle.com/database/adb-free:latest',
        name: service.service,
        ports: [`${service.spec.listenerPort}:1522`, `${service.spec.ordsPort}:8443`],
        environment: {
          WORKLOAD_TYPE: 'ATP',
          ADMIN_PASSWORD: '${ODBVUE_ADMIN_PASSWORD}',
          WALLET_PASSWORD: '${ODBVUE_WALLET_PASSWORD}',
        },
        cap_add: ['SYS_ADMIN'],
        devices: ['/dev/fuse:/dev/fuse'],
      }
    }
  })

  const composeFileContent = {
    name: projectNameWithEnv,
    services,
  }

  const composeFile = new YamlFile(path.resolve(envDir, 'podman-compose.yaml'))
  composeFile.set(composeFileContent)
  await podman.composeUp(envDir)

  await podman.waitForComposeContainers(projectNameWithEnv)

  const containers = podman.getContainerStatuses(projectNameWithEnv)
  containers
    .filter((c) => c.name === `${projectName}-adb`)
    .forEach(async (c) => {
      const walletDir = path.join(envDir, '.wallets', `${projectName}-adb.zip`)
      await podman.downloadDbWalletZip(c.name, walletDir)
    })

  containers.forEach((c) => {
    logger.success(`${c.name} is ${c.health.toUpperCase()}`)
  })
  logger.lf()
}
