import prompts from 'prompts'

import { logger } from '../shared/logger.js'

import { availablePlatforms } from '../adapters/config-store.js'

import { runSetupPlatformLocalPodman } from './setup-platforms-local-podman.js'
import { runSetupPlatformOci } from './setup-platforms-oci.js'

export const runSetupPlatforms = async () => {
  logger.info('Setting up deployment platforms...')

  const { platform } = await prompts([
    {
      type: 'multiselect',
      name: 'platform',
      message: 'Deployment platform',
      choices: availablePlatforms,
      min: 1,
    },
  ])

  if (platform.includes('local-podman')) {
    await runSetupPlatformLocalPodman()
  }

  if (platform.includes('oci')) {
    await runSetupPlatformOci()
  }

  logger.lf()
}
