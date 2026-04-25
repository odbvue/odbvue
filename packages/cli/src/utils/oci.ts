import * as common from 'oci-common'
import * as identity from 'oci-identity'
import { logger } from './logger.js'

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

  constructor(filePath: string, profile = 'DEFAULT') {
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

  async getCompartmentList(): Promise<identity.models.Compartment[]> {
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
    const compartments = await this.getCompartmentList()
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
    const compartments = await this.getCompartmentList()
    return compartments.find((c) => c.name === name) || null
  }
}
