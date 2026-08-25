import { logger } from '../shared/logger.js'

import { PodmanClient } from '../adapters/podman-client.js'
import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'

import { PODMAN_MIN_CPUS, PODMAN_MIN_MEMORY_GB } from '../shared/const.js'

export const runSetupPlatformLocalPodman = async () => {
  const { projectName, currentEnv } = new EnvironmentStore().getCurrent()
  const podman = new PodmanClient()
  if (!podman.isInstalled())
    logger.fatal(
      'Podman is not installed. Please install Podman to use local deployment: https://podman.io/docs/installation',
    )
  if (!podman.isRunning()) {
    logger.info('Starting Podman machine...')
    if (!podman.startMachine()) {
      logger.fatal('Failed to start Podman machine. Please start it manually and try again.')
    }
  }
  const { cpus, memoryGb } = podman.checkResources()
  if (cpus < PODMAN_MIN_CPUS || memoryGb < PODMAN_MIN_MEMORY_GB) {
    logger.warn(
      `Podman machine has insufficient resources (CPUs: ${cpus}, Memory: ${memoryGb} GB).  It is recommended to allocate at least ${PODMAN_MIN_CPUS} CPUs and ${PODMAN_MIN_MEMORY_GB} GB of memory.`,
    )
  }

  const config = new ConfigStore()
  config.addPlatform({ platform: 'local-podman', spec: { name: `${projectName}-${currentEnv}` } })
}
