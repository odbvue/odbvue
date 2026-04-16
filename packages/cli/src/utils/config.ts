import path from 'path'
import fs from 'fs'

import { rootDir } from './index.js'
import { EnvFile } from './envFile.js'

export class Config {
  configDir = path.join(rootDir, 'config')
  private envFile = new EnvFile(path.join(this.configDir, '.env'))

  listEnvironments = (): string[] => {
    if (!fs.existsSync(this.configDir)) return []
    const entries = fs.readdirSync(this.configDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  }

  getProjectName = (): string | undefined => this.envFile.get('ODBVUE_PROJECT_NAME')
  setProjectName = (name: string) => this.envFile.set('ODBVUE_PROJECT_NAME', name)

  getCurrentEnvironment = (): string | undefined => this.envFile.get('ODBVUE_CURRENTENVIRONMENT')
  setCurrentEnvironment = (env: string) => {
    this.envFile.set('ODBVUE_CURRENTENVIRONMENT', env)
    const envDir = path.join(this.configDir, env)
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
    }
  }
}
