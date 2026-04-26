import fs from 'fs'
import path from 'path'

import { configDir } from '../shared/dirs.js'
import { EnvFile } from '../shared/envFile.js'

import { DEFAULT_CURRENT_ENVIRONMENT, DEFAULT_PROJECT_NAME } from '../shared/const.js'

type Environment = {
  projectName: string
  currentEnv: string
  envDir: string
  envFilePath: string
}

export class EnvironmentStore {
  private envFile = new EnvFile(path.join(configDir, '.env'))

  getAvailable = (): string[] => {
    if (!fs.existsSync(configDir)) return []
    const entries = fs.readdirSync(configDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  }

  getCurrent = (): Environment => {
    const projectName = this.envFile.get('ODBVUE_PROJECT_NAME') || DEFAULT_PROJECT_NAME
    const currentEnv = this.envFile.get('ODBVUE_CURRENT_ENVIRONMENT') || DEFAULT_CURRENT_ENVIRONMENT
    const envDir = path.join(configDir, currentEnv)
    const envFilePath = path.join(envDir, `${currentEnv}.yaml`)
    return { projectName, currentEnv, envDir, envFilePath }
  }

  setCurrent = (projectName: string, currentEnv: string) => {
    this.envFile.set('ODBVUE_PROJECT_NAME', projectName)
    this.envFile.set('ODBVUE_CURRENT_ENVIRONMENT', currentEnv)
    const envDir = path.join(configDir, currentEnv)
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
    }
  }
}
