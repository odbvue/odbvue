import path from 'path'

import { logger } from '../shared/logger.js'
import { YamlFile } from '../shared/yamlFile.js'
import { unZip } from '../shared/zip.js'

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

  if (!podman.isInstalled()) {
    logger.fatal('Podman is not installed. Please install Podman to continue.')
  } else logger.muted('Podman is installed...')

  if (!podman.isRunning()) {
    if (!podman.startMachine()) {
      logger.fatal('Failed to start Podman.')
    }
  } else logger.muted('Podman is running...')

  let services: Record<string, unknown> = {}
  const localAdbNames = new Set<string>()
  const reusedContainerNames = new Set<string>()
  config.getConfig().services.forEach((service) => {
    if (service.kind === 'oracle-adb' && service.platform === 'local-podman') {
      localAdbNames.add(service.service)
      if (service.spec.reuseExisting === true) {
        reusedContainerNames.add(service.service)
        return
      }
      services['oracle-adb'] = {
        image: 'container-registry.oracle.com/database/adb-free:latest',
        name: service.service,
        ports: [`${service.spec.listenerPort}:1522`, `${service.spec.ordsPort}:8443`],
        environment: {
          WORKLOAD_TYPE: 'ATP',
          ADMIN_PASSWORD: '${ODBVUE_ADB_ADMIN_PASSWORD}',
          WALLET_PASSWORD: '${ODBVUE_ADB_WALLET_PASSWORD}',
        },
        cap_add: ['SYS_ADMIN'],
        devices: ['/dev/fuse:/dev/fuse'],
      }
    }
  })

  if (Object.keys(services).length > 0) {
    const composeFileContent = {
      name: projectNameWithEnv,
      services,
    }
    const composeFile = new YamlFile(path.resolve(envDir, 'podman-compose.yaml'))
    composeFile.set(composeFileContent)
    await podman.composeUp(envDir)
    await podman.waitForComposeContainers(projectNameWithEnv)
  }

  const allContainers = podman.getContainerStatuses()
  for (const containerName of reusedContainerNames) {
    const container = allContainers.find((item) => item.name === containerName)
    if (!container) {
      logger.fatal(`Existing container "${containerName}" was not found.`)
    } else if (container.state !== 'running') {
      await podman.startContainer(containerName)
    } else {
      await podman.waitForContainerHealth(containerName)
    }
  }

  const containers = podman
    .getContainerStatuses(projectNameWithEnv)
    .concat(allContainers.filter((container) => reusedContainerNames.has(container.name)))
  for (const container of containers.filter((item) => localAdbNames.has(item.name))) {
    const walletPath = path.join(envDir, '.wallets', `${container.name}.zip`)
    await podman.downloadDbWalletZip(container.name, walletPath)
    const extractDir = path.join(envDir, '.wallets', container.name)
    await unZip(walletPath, extractDir)
  }

  containers.forEach((c) => {
    logger.success(`${c.name} is up and running (${c.state}, ${c.status}) [${c.ports.join(', ')}]`)
  })
  logger.lf()
}
