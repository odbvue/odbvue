import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'

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

  async findAdbInstance(
    name: string,
    compartmentId: string,
  ): Promise<database.models.AutonomousDatabaseSummary | null> {
    try {
      const databaseClient = new database.DatabaseClient({
        authenticationDetailsProvider: this.provider,
      })
      const resp = await databaseClient.listAutonomousDatabases({
        compartmentId,
        displayName: name,
      })
      return (
        resp.items.find(
          (db) =>
            db.lifecycleState !== database.models.AutonomousDatabase.LifecycleState.Terminated &&
            db.lifecycleState !== database.models.AutonomousDatabase.LifecycleState.Terminating,
        ) ?? null
      )
    } catch (err) {
      this.showError(err)
    }
  }

  isAdbAvailable(instance: database.models.AutonomousDatabaseSummary): boolean {
    return instance.lifecycleState === database.models.AutonomousDatabase.LifecycleState.Available
  }

  async createAdbInstance(
    name: string,
    password: string,
    compartmentId: string,
    spec?: {
      dbWorkload?: string
      cpuCoreCount?: number
      dataStorageSizeInTBs?: number
      isFreeTier?: boolean
      isMtlsConnectionRequired?: boolean
    },
  ): Promise<string> {
    try {
      const databaseClient = new database.DatabaseClient({
        authenticationDetailsProvider: this.provider,
      })
      const resp = await databaseClient.createAutonomousDatabase({
        createAutonomousDatabaseDetails: {
          compartmentId,
          dbName: name.replace(/[^a-zA-Z0-9]/g, ''),
          displayName: name,
          cpuCoreCount: spec?.cpuCoreCount || 1,
          dataStorageSizeInTBs: spec?.dataStorageSizeInTBs || 1,
          isMtlsConnectionRequired:
            spec?.isMtlsConnectionRequired !== undefined ? spec.isMtlsConnectionRequired : true,
          isFreeTier: spec?.isFreeTier !== undefined ? spec.isFreeTier : true,
          source: 'NEW',
          adminPassword: password,
        },
      })
      return resp.autonomousDatabase.id!
    } catch (err) {
      this.showError(err)
    }
  }

  async waitForAdbAvailable(
    autonomousDatabaseId: string,
    intervalMs = 15000,
    timeoutMs = 600000,
  ): Promise<void> {
    const databaseClient = new database.DatabaseClient({
      authenticationDetailsProvider: this.provider,
    })
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const resp = await databaseClient.getAutonomousDatabase({ autonomousDatabaseId })
      const state = resp.autonomousDatabase.lifecycleState
      if (state === database.models.AutonomousDatabase.LifecycleState.Available) return
      if (
        state === database.models.AutonomousDatabase.LifecycleState.Terminated ||
        state === database.models.AutonomousDatabase.LifecycleState.Unavailable
      ) {
        throw new Error(`Autonomous Database ${autonomousDatabaseId} entered state: ${state}`)
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
    }
    throw new Error(
      `Timed out waiting for Autonomous Database ${autonomousDatabaseId} to become available`,
    )
  }

  async deleteAdbInstance(autonomousDatabaseId: string): Promise<void> {
    try {
      const databaseClient = new database.DatabaseClient({
        authenticationDetailsProvider: this.provider,
      })
      await databaseClient.deleteAutonomousDatabase({ autonomousDatabaseId })
    } catch (err) {
      this.showError(err)
    }
  }

  async getAdbWallet(
    autonomousDatabaseId: string,
    password: string,
    outputZipPath: string,
  ): Promise<string> {
    try {
      const databaseClient = new database.DatabaseClient({
        authenticationDetailsProvider: this.provider,
      })
      const resp = await databaseClient.generateAutonomousDatabaseWallet({
        autonomousDatabaseId,
        generateAutonomousDatabaseWalletDetails: {
          password: password,
        },
      })
      const outputDir = path.dirname(outputZipPath)
      fs.mkdirSync(outputDir, { recursive: true })
      await pipeline(resp.value as NodeJS.ReadableStream, fs.createWriteStream(outputZipPath))
      return outputZipPath
    } catch (err) {
      this.showError(err)
    }
  }
}
