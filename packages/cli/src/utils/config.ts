import path from 'path'
import dotenv from 'dotenv'
import fs from 'fs'

import { rootDir } from './index.js'

export class Config {
  configDir = path.join(rootDir, 'config')

  listEnvironments = (): string[] => {
    if (!fs.existsSync(this.configDir)) {
      return []
    }
    const entries = fs.readdirSync(this.configDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  }

  getEnvironment = (): string | undefined => {
    const envPath = path.join(this.configDir, '.env')
    if (!fs.existsSync(envPath)) return undefined
    const env = dotenv.config({ path: envPath }).parsed
    return env?.ODBVUE_ENVIRONMENT
  }

  setEnvironment = (env: string) => {
    const envPath = path.join(this.configDir, '.env')
    const envContent = `ODBVUE_ENVIRONMENT=${env}`
    fs.writeFileSync(envPath, envContent)
  }
}
