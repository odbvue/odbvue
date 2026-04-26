import fs from 'fs'

import { YamlFile } from '../shared/yamlFile.js'

import { EnvironmentStore } from './environment-store.js'

type OciSpec = {
  profile: string
  tenancy: string
  region: string
  compartment: {
    id: string
    name: string
  }
}

type PodmanSpec = {
  name: string
}

type Platform =
  | {
      platform: 'oci'
      spec: OciSpec
    }
  | {
      platform: 'local-podman'
      spec: PodmanSpec
    }

type Service = {
  name: string
  kind: 'oracle-adb' | 'oracle-object-storage' | 'compute'
  platform: 'oci' | 'local-podman'
  spec: Record<string, unknown>
}

type Config = {
  platforms: Platform[]
  services: Service[]
}

export const availablePlatforms = [
  { title: 'Oracle Cloud Infrastructure', value: 'oci', selected: true },
  { title: 'Local Podman Containers', value: 'local-podman', selected: true },
]

export class ConfigStore {
  private config: Config = { platforms: [], services: [] }

  constructor() {
    const EnvStore = new EnvironmentStore()
    const { envFilePath } = EnvStore.getCurrent()
    if (fs.existsSync(envFilePath)) {
      const yamlFile = new YamlFile(envFilePath)
      this.config = yamlFile.get() as Config
    } else {
      const yamlFile = new YamlFile(envFilePath)
      yamlFile.set(this.config)
    }
  }

  private saveConfig = () => {
    const EnvStore = new EnvironmentStore()
    const { envFilePath } = EnvStore.getCurrent()
    const yamlFile = new YamlFile(envFilePath)
    yamlFile.set(this.config)
  }

  getConfig = (): Config => {
    return this.config
  }

  getPlatforms = (): string[] => {
    return this.config.platforms.map((p) => p.platform)
  }

  addPlatform = (platform: Platform) => {
    if (!this.getPlatforms().includes(platform.platform)) {
      this.config.platforms.push(platform)
    } else {
      this.config.platforms = this.config.platforms.map((p) =>
        p.platform === platform.platform ? platform : p,
      )
    }
    this.saveConfig()
  }

  addService = (service: Service) => {
    const existingServiceIndex = this.config.services.findIndex((s) => s.name === service.name)
    if (existingServiceIndex === -1) {
      this.config.services.push(service)
    } else {
      this.config.services[existingServiceIndex] = service
    }
    this.saveConfig()
  }
}
