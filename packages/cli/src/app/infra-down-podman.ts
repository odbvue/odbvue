import { logger } from '../shared/logger.js'
import { EnvironmentStore } from '../adapters/environment-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

export const runInfraDownPodman = async () => {
  logger.info('Shutting down local infrastructure...')

  const environmentStore = new EnvironmentStore()
  const { envDir } = environmentStore.getCurrent()

  const podman = new PodmanClient()
  await podman.composeDown(envDir)

  logger.info('Local infrastructure is shut down!')
  logger.lf()
}
