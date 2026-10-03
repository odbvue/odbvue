import fs from 'fs/promises'
import path from 'path'

import { ConfigStore } from '../adapters/config-store.js'
import { webDir } from '../shared/dirs.js'
import { EnvFile } from '../shared/envFile.js'
import { logger } from '../shared/logger.js'

export const runConfigureWeb = async (appDir = webDir): Promise<void> => {
  const apiUrl = new ConfigStore().getConfig().runtime?.apiUrl
  if (!apiUrl) return
  const apiUri = new URL(apiUrl).href
  await fs.mkdir(appDir, { recursive: true })
  const envPath = path.join(appDir, '.env')
  new EnvFile(envPath).set('VITE_API_URI', apiUri)
  logger.success(`Generated ${envPath}`)
  logger.lf()
}
