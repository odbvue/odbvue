import { logger } from '../shared/logger.js'
import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

export const runInfraDownPodman = async () => {
  logger.info('Shutting down local infrastructure...')

  const environmentStore = new EnvironmentStore()
  const { envDir } = environmentStore.getCurrent()

  const podman = new PodmanClient()
  const config = new ConfigStore()
  const localAdbServices = config
    .getConfig()
    .services.filter(
      (service) => service.kind === 'oracle-adb' && service.platform === 'local-podman',
    )
  if (localAdbServices.length > 1) throw new Error('Local Podman supports exactly one ADB service.')
  if (localAdbServices.length === 1 && !(await podman.composeDown(envDir))) {
    throw new Error('Failed to shut down local ADB.')
  }
  logger.info('Local infrastructure is shut down!')
  logger.lf()
}
