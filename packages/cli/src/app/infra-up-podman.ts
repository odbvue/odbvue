import path from 'path'

import { logger } from '../shared/logger.js'
import { YamlFile } from '../shared/yamlFile.js'
import { unZip } from '../shared/zip.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'
import {
  ensureLocalKek,
  getLocalKekName,
  getLocalKmsCompose,
  KMS_SERVICE_NAME,
  writeLocalKmsBuildContext,
} from './setup-resources-kms.js'

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

  const localAdbServices = config
    .getConfig()
    .services.filter(
      (service) => service.kind === 'oracle-adb' && service.platform === 'local-podman',
    )
  if (localAdbServices.length === 0) return

  ensureLocalKek(podman)
  writeLocalKmsBuildContext(envDir)

  const kekName = getLocalKekName(projectName, currentEnv)
  const internalNetworkName = `${projectNameWithEnv}-internal`

  const services: Record<string, unknown> = {
    [KMS_SERVICE_NAME]: getLocalKmsCompose(kekName),
  }
  localAdbServices.forEach((service) => {
    if (service.kind === 'oracle-adb') {
      services['oracle-adb'] = {
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
        networks: ['odbvue-internal'],
      }
    }
  })

  if (Object.keys(services).length > 0) {
    const composeFileContent = {
      name: projectNameWithEnv,
      services,
      networks: { 'odbvue-internal': { name: internalNetworkName } },
      secrets: { [kekName]: { external: true } },
    }
    const composeFile = new YamlFile(path.resolve(envDir, 'podman-compose.yaml'))
    composeFile.set(composeFileContent)
    logger.info('Reconciling local services with Podman Compose...')
    await podman.composeUp(envDir)
    await podman.waitForComposeContainers(projectNameWithEnv)
  }

  const containers = podman.getContainerStatuses(projectNameWithEnv)
  for (const container of containers.filter((item) => item.name === 'odbvue-adb')) {
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
