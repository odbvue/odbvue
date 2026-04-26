import path from 'path'

import { logger } from '../shared/logger.js'

import { YamlFile } from '../shared/yamlFile.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

export const runInfraUpOracleAdb = async () => {
  logger.info('Starting Oracle ADB in local POdman container...')
  const { projectName, currentEnv, envDir } = new EnvironmentStore().getCurrent()

  const config = new ConfigStore()
  let services: Record<string, unknown> = {}
  config.getConfig().services.forEach((service) => {
    if (service.kind === 'oracle-adb') {
      services['oracle-adb'] = {
        image: 'container-registry.oracle.com/database/adb-free:latest',
        name: service.name,
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
    name: `${projectName}-${currentEnv}`,
    services,
  }

  const composeFile = new YamlFile(path.resolve(envDir, 'podman-compose.yaml'))
  composeFile.set(composeFileContent)
  const podman = new PodmanClient()
  await podman.composeUp(envDir)

  const projectNameWithEnv = `${projectName}-${currentEnv}`
  await podman.waitForComposeContainers(projectNameWithEnv)

  const containers = podman.getComposeContainerStatuses(projectNameWithEnv)
  const adbContainer = containers.find((c) => c.name.includes('adb'))
  if (!adbContainer) {
    throw new Error('ADB container not found in compose project')
  }

  const walletDir = path.join(envDir, '.wallets', `${projectName}.zip`)
  await podman.downloadDbWalletZip(adbContainer.name, walletDir)

  logger.success('Oracle ADB is ready!')
  logger.lf()
}
