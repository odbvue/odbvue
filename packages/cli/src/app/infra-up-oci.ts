import path from 'path'

import { OciClient } from '../adapters/oci-client.js'
import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { SecretsStore } from '../adapters/secrets-store.js'

import { logger } from '../shared/logger.js'

export const runInfraUpOci = async () => {
  const config = new ConfigStore()
  const services = config
    .getConfig()
    .services.filter((service) => service.kind === 'oracle-adb' && service.platform === 'oci')
  if (services.length === 0) return

  logger.info('Starting Oracle ADB on OCI...')

  const environmentStore = new EnvironmentStore()
  const { envDir } = environmentStore.getCurrent()
  const ociFilePath = path.join(envDir, '.oci', 'config')

  const profile = config.getConfig().platforms.find((p) => p.platform === 'oci')?.spec.profile
  const compartmentId = config.getConfig().platforms.find((p) => p.platform === 'oci')?.spec
    .compartment.id as string

  const ociClient = new OciClient(ociFilePath, profile)

  for (const service of services) {
    const existing = await ociClient.findAdbInstance(service.service, compartmentId)

    let adbId: string

    if (existing) {
      if (ociClient.isAdbAvailable(existing)) {
        logger.warn(`${service.service} already exists and is available.`)
      } else {
        logger.warn(
          `${service.service} already exists (state: ${existing.lifecycleState}). Starting it...`,
        )
        await ociClient.startAdbInstance(existing.id!)
        logger.info(`Waiting for ${service.service} to become available...`)
        await ociClient.waitForAdbAvailable(existing.id!)
        logger.success(`${service.service} is available.`)
      }
      adbId = existing.id!
    } else {
      logger.info(`Deploying ${service.service}...`)
      const secrets = new SecretsStore()
      const password = secrets.get('ODBVUE_ADB_WALLET_PASSWORD') || ''
      adbId = await ociClient.createAdbInstance(
        service.service,
        password,
        compartmentId,
        service.spec,
      )
      logger.info(`Waiting for ${service.service} to become available...`)
      await ociClient.waitForAdbAvailable(adbId)
      logger.success(`${service.service} is available.`)
    }

    const secrets = new SecretsStore()
    const password = secrets.get('ODBVUE_ADB_WALLET_PASSWORD') || ''

    const walletDir = path.join(envDir, '.wallets', `${service.service}.zip`)
    logger.info(`Downloading wallet for ${service.service} to ${walletDir}...`)
    await ociClient.getAdbWallet(adbId, password, walletDir)
  }

  logger.success('Oracle ADB instances on OCI are up and available.')
  logger.lf()
}
