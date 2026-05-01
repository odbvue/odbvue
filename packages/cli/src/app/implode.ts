import prompts from 'prompts'
import fs from 'fs'

import { logger } from '../shared/logger.js'

import { EnvironmentStore } from '../adapters/environment-store.js'
import { ConfigStore } from '../adapters/config-store.js'
import { PodmanClient } from '../adapters/podman-client.js'

export const runImplode = async () => {
  logger.info('Removing project setup...')
  logger.warn('This action cannot be undone!')
  const { currentEnv, envDir } = new EnvironmentStore().getCurrent()

  const { confirm } = await prompts({
    type: 'confirm',
    name: 'confirm',
    message: `Are you sure you want to remove the project setup for "${currentEnv}" environment?`,
  })

  if (!confirm) {
    logger.info('Implode cancelled.')
    return
  }

  const config = new ConfigStore()
  const platforms = config.getConfig().platforms

  if (platforms.some((p) => p.platform === 'local-podman')) {
    logger.info('Removing local Podman containers...')
    const podman = new PodmanClient()
    const removed = await podman.composeDown(envDir)
    if (!removed) {
      logger.warn('Failed to remove Podman containers.')
    }
  }

  if (fs.existsSync(envDir)) {
    fs.rmSync(envDir, { recursive: true })
    logger.info('Removed environment directory.')
  }

  logger.success(`Project setup for "${currentEnv}" environment has been removed.`)
  logger.lf()
}
