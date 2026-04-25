import path from 'path'
import fs from 'fs'

import { rootDir } from './index.js'
import { EnvFile } from './envFile.js'
import { YamlFile } from './yamlFile.js'

type OciSpec = {
  profile: string
  tenancy: string
  region: string
  compartment: {
    id: string
    name: string
  }
}

type Platform =
  | {
      platform: 'oci'
      spec: OciSpec
    }
  | {
      platform: 'local'
      spec?: Record<string, unknown>
    }

type Resource = {
  name: string
  type: 'adb' | 'storage' | 'compute'
  platform: 'oci' | 'local'
  spec: Record<string, unknown>
}

type EnvironmentConfig = {
  platforms: Platform[]
  resources: Resource[]
}

export class Config {
  configDir = path.join(rootDir, 'config')
  private envFile = new EnvFile(path.join(this.configDir, '.env'))

  listEnvironments = (): string[] => {
    if (!fs.existsSync(this.configDir)) return []
    const entries = fs.readdirSync(this.configDir, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)
  }

  getProjectName = (): string => this.envFile.get('ODBVUE_PROJECT_NAME') || 'odbvue'
  setProjectName = (name: string) => this.envFile.set('ODBVUE_PROJECT_NAME', name)

  getCurrentEnvironment = (): string => this.envFile.get('ODBVUE_CURRENT_ENVIRONMENT') || 'dev'
  setCurrentEnvironment = (env: string) => {
    this.envFile.set('ODBVUE_CURRENT_ENVIRONMENT', env)
    const envDir = path.join(this.configDir, env)
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true })
      const configPath = path.join(envDir, `${env}.yaml`)
      const yamlFile = new YamlFile<EnvironmentConfig>(configPath)
      yamlFile.set({ platforms: [], resources: [] })
    }
  }

  addResource = (resource: Resource) => {
    const env = this.getCurrentEnvironment()
    if (!env) throw new Error('No environment selected')

    const envDir = path.join(this.configDir, env)
    const configPath = path.join(envDir, `${env}.yaml`)

    const yamlFile = new YamlFile<EnvironmentConfig>(configPath)
    let config = yamlFile.get()

    if (!config || !config.resources) {
      config = { platforms: [], resources: [] }
    }

    config.resources = config.resources.filter((r) => r.name !== resource.name)
    config.resources.push(resource)
    yamlFile.set(config)
  }

  getResources = (): Resource[] => {
    const env = this.getCurrentEnvironment()
    if (!env) return []

    const envDir = path.join(this.configDir, env)
    const configPath = path.join(envDir, `${env}.yaml`)

    const yamlFile = new YamlFile<EnvironmentConfig>(configPath)
    const config = yamlFile.get()
    return config?.resources || []
  }

  addPlatform = (platform: Platform) => {
    const env = this.getCurrentEnvironment()
    if (!env) throw new Error('No environment selected')

    const envDir = path.join(this.configDir, env)
    const configPath = path.join(envDir, `${env}.yaml`)

    const yamlFile = new YamlFile<EnvironmentConfig>(configPath)
    let config = yamlFile.get()

    if (!config || !config.platforms) {
      config = { platforms: [], resources: [] }
    }

    config.platforms = config.platforms.filter((p) => p.platform !== platform.platform)
    config.platforms.push(platform)
    yamlFile.set(config)
  }

  getPlatforms = (): Platform[] => {
    const env = this.getCurrentEnvironment()
    if (!env) return []

    const envDir = path.join(this.configDir, env)
    const configPath = path.join(envDir, `${env}.yaml`)

    const yamlFile = new YamlFile<EnvironmentConfig>(configPath)
    const config = yamlFile.get()
    return config?.platforms || []
  }
}
