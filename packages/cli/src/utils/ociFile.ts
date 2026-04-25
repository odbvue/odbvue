import path from 'path'
import fs from 'fs'
import { configDir } from './index.js'

type OCIProfile = {
  user: string
  fingerprint: string
  tenancy: string
  region: string
  key_file: string
}

type OCIConfig = {
  [profile: string]: OCIProfile
}

export class OciFile {
  private configPath: string

  constructor(environment: string) {
    this.configPath = path.join(configDir, environment, '.oci', 'config')
  }

  read = (): OCIConfig => {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`OCI config file not found at ${this.configPath}`)
    }

    const content = fs.readFileSync(this.configPath, 'utf-8')
    return this.parseIniContent(content)
  }

  getProfile = (profileName: string): OCIProfile | undefined => {
    const config = this.read()
    return config[profileName]
  }

  listProfiles = (): string[] => {
    const config = this.read()
    return Object.keys(config)
  }

  private parseIniContent = (content: string): OCIConfig => {
    const config: OCIConfig = {}
    let currentProfile: string | null = null

    const lines = content.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) continue

      // Check for profile section [profile_name]
      const profileMatch = trimmedLine.match(/^\[([^\]]+)\]$/)
      if (profileMatch) {
        currentProfile = profileMatch[1]
        config[currentProfile] = {
          user: '',
          fingerprint: '',
          tenancy: '',
          region: '',
          key_file: '',
        }
        continue
      }

      // Parse key=value pairs
      if (currentProfile) {
        const [key, value] = trimmedLine.split('=').map((s) => s.trim())
        if (key && value) {
          const profile = config[currentProfile]
          if (key in profile) {
            ;(profile as Record<string, string>)[key] = value
          }
        }
      }
    }

    return config
  }
}
