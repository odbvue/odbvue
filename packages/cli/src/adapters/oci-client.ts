import fs from 'fs'

import * as common from 'oci-common'
import * as identity from 'oci-identity'
import * as database from 'oci-database'

import { logger } from '../shared/logger.js'

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

  constructor(ociFilePath: string) {
    this.configPath = ociFilePath
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

  getProfiles = (): string[] => {
    const config = this.read()
    return Object.keys(config)
  }

  private parseIniContent = (content: string): OCIConfig => {
    const config: OCIConfig = {}
    let currentProfile: string | null = null

    const lines = content.split('\n')

    for (const line of lines) {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith('#')) continue

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

export class OciClient {
  private provider: common.ConfigFileAuthenticationDetailsProvider
  private identityClient: identity.IdentityClient

  profileName: string

  compartment: identity.models.Compartment | undefined = undefined

  private showError(err: unknown): never {
    const errorMessage = err instanceof Error ? err.message : String(err)
    logger.error(`Error: ${errorMessage}`)
    process.exit(1)
  }

  constructor(filePath: string, profile: string = 'DEFAULT') {
    this.provider = new common.ConfigFileAuthenticationDetailsProvider(filePath, profile)
    this.identityClient = new identity.IdentityClient({
      authenticationDetailsProvider: this.provider,
    })
    this.profileName = profile
  }

  get tenancyId(): string {
    return this.provider.getTenantId()
  }

  get regionId(): string {
    return this.provider.getRegion().regionId
  }

  async getTenancy(): Promise<identity.models.Tenancy> {
    try {
      const resp = await this.identityClient.getTenancy({ tenancyId: this.tenancyId })
      return resp.tenancy!
    } catch (err) {
      this.showError(err)
    }
  }

  async getCompartments(): Promise<identity.models.Compartment[]> {
    try {
      const resp = await this.identityClient.listCompartments({ compartmentId: this.tenancyId })
      return resp.items || []
    } catch (err) {
      this.showError(err)
    }
  }

  async createCompartment(name: string, description: string): Promise<identity.models.Compartment> {
    try {
      const resp = await this.identityClient.createCompartment({
        createCompartmentDetails: { compartmentId: this.tenancyId, name, description },
      })
      return resp.compartment!
    } catch (err) {
      this.showError(err)
    }
  }

  async createCompartmentIfNotExists(
    name: string,
    description: string,
  ): Promise<identity.models.Compartment> {
    const compartments = await this.getCompartments()
    this.compartment =
      compartments.find((c) => c.name === name && c.lifecycleState === 'ACTIVE') || undefined
    if (!this.compartment) {
      this.compartment = await this.createCompartment(name, description)
    }
    return this.compartment
  }

  async deleteCompartment(compartmentId: string): Promise<void> {
    try {
      await this.identityClient.deleteCompartment({ compartmentId })
      logger.success(`Compartment ${compartmentId} deleted.`)
    } catch (err) {
      this.showError(err)
    }
  }

  async findCompartment(name: string): Promise<identity.models.Compartment | null> {
    const compartments = await this.getCompartments()
    return compartments.find((c) => c.name === name) || null
  }

  async getAdbInstances(): Promise<database.models.AutonomousDatabaseSummary[]> {
    try {
      const databaseClient = new database.DatabaseClient({
        authenticationDetailsProvider: this.provider,
      })
      const resp = await databaseClient.listAutonomousDatabases({
        compartmentId: this.compartment?.id || this.tenancyId,
      })
      return resp.items || []
    } catch (err) {
      this.showError(err)
    }
  }
}
