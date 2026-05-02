import path from 'path'

import { logger } from '../shared/logger.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

import { OciClient } from '../adapters/oci-client.js'

import { runDbExec } from './db-exec.js'

export const runInfraStatus = async () => {
  const config = new ConfigStore()
  const platforms = config.getConfig().platforms

  for (const platform of platforms) {
    logger.info(`Platform: ${platform.platform}`)

    if (platform.platform === 'local-podman') {
      const podman = new PodmanClient()
      const isRunning = await podman.isRunning()
      if (isRunning) {
        const containers = await podman.getContainerStatuses()
        if (containers.length > 0) {
          logger.muted('Containers:')
          containers.forEach((c) => {
            logger.muted(`  - ${c.name}: (${c.state}, ${c.status}) [${c.ports.join(', ')}]`)
          })
        } else {
          logger.muted('No containers found')
        }
        logger.success('Local Podman is running')
      } else {
        logger.warn('Local Podman is not running')
      }
    }

    if (platform.platform === 'oci') {
      const environmentStore = new EnvironmentStore()
      const { envDir } = environmentStore.getCurrent()
      const ociFilePath = path.join(envDir, '.oci', 'config')

      const profile = platform.spec.profile
      try {
        const oci = new OciClient(ociFilePath, profile)
        const compartments = await oci.getCompartments()
        if (compartments.length > 0) {
          logger.muted('Compartments:')
          for (const compartment of compartments) {
            const activeCompartment = platform.spec.compartment.id === compartment.id
            logger.muted(`  - ${compartment.name} ${activeCompartment ? ' [✓]' : ''}`)
          }
        }
        logger.success('OCI is available')
      } catch {
        logger.warn('OCI is not available')
      }
    }

    logger.lf()
  }

  const services = config.getConfig().services

  for (const service of services) {
    logger.info(`Service: ${service.service}`)
    if (service.kind === 'oracle-adb') {
      logger.muted('Check:')
      const statement = `SELECT 'OK' AS "status" FROM dual`
      const response = await runDbExec(statement, true)
      const status = (response.rows?.[0] as { status: string })?.['status'] ?? 'UNKNOWN'
      logger.muted(`  - status: ${status}`)
      if (status === 'OK') {
        logger.success('Oracle ADB service is reachable')
      }
    }
    logger.lf()
  }
}
