import path from 'path'

import { EnvFile } from '../shared/envFile.js'

import { EnvironmentStore } from './environment-store.js'

export class SecretsStore {
  private envFile: EnvFile

  constructor() {
    const { envDir } = new EnvironmentStore().getCurrent()
    const envFilePath = path.join(envDir, '.env')
    this.envFile = new EnvFile(envFilePath)
  }

  get(key: string): string | undefined {
    return this.envFile.get(key)
  }

  set(key: string, value: string): void {
    this.envFile.set(key, value)
  }
}
