import type { TableInfo, SqlStatement } from '../ddl/table.js'
import { Entity } from '../ddl/table.js'
import type { UpsertInfo } from '../dml/upsert.js'
import { Upsert } from '../dml/upsert.js'
import { Method } from './method.js'
import type { ServiceInfo } from './service.js'
import { Service } from './service.js'

export type ServiceExport = ServiceInfo

export type SchemaExport = {
  schema: string
  exported: string
  tables: TableInfo[]
  upserts?: UpsertInfo[]
  services?: ServiceExport[]
}

export type MultiFileSchemaExport = {
  schema: string
  exported: string
  tables: Array<{
    filename: string
    info: TableInfo
  }>
  upserts?: Array<{
    filename: string
    info: UpsertInfo
  }>
  services?: Array<{
    filename: string
    info: ServiceExport
  }>
}

export class Schema {
  private name: string
  private tables: Entity[] = []
  private upserts: Upsert[] = []
  private methods: Method[] = []
  private services: Service[] = []

  constructor(name: string) {
    this.name = name
  }

  addEntity(table: Entity): this {
    this.tables.push(table)
    return this
  }

  addEntities(tables: Entity[]): this {
    this.tables.push(...tables)
    return this
  }

  addUpsert(upsert: Upsert): this {
    this.upserts.push(upsert)
    return this
  }

  addUpserts(upserts: Upsert[]): this {
    this.upserts.push(...upserts)
    return this
  }

  addMethod(method: Method): this {
    this.methods.push(method)
    return this
  }

  addMethods(methods: Method[]): this {
    this.methods.push(...methods)
    return this
  }

  addService(service: Service): this {
    this.services.push(service)
    return this
  }

  addServices(services: Service[]): this {
    this.services.push(...services)
    return this
  }

  /**
   * Render as single JSON string (legacy format)
   */
  render(): string {
    const currentTimestamp = new Date().toISOString()

    const tableInfos: TableInfo[] = this.tables.map((table) => table.toTableInfo())
    const upsertInfos: UpsertInfo[] = this.upserts.map((upsert) => upsert.toObject())
    const serviceExports = this.renderServices()

    const schemaExport: SchemaExport = {
      schema: this.name.toUpperCase(),
      exported: currentTimestamp,
      tables: tableInfos,
      ...(upsertInfos.length > 0 && { upserts: upsertInfos }),
      ...(serviceExports.length > 0 && { services: serviceExports }),
    }

    return JSON.stringify(schemaExport, null, 2)
  }

  /**
   * Render for multi-file output - returns metadata with individual table info
   */
  renderMultiFile(): string {
    const currentTimestamp = new Date().toISOString()

    const tablesWithFilenames = this.tables.map((table) => {
      const info = table.toTableInfo()
      // Convert table name to filename: APP_USERS -> app_users.json
      const filename = info.name.toLowerCase()
      return { filename, info }
    })

    const upsertsWithFilenames = this.upserts.map((upsert, index) => {
      const info = upsert.toObject()
      // Use table name + index for upsert filename: app_roles_upsert_0.json
      const filename = `${info.table.toLowerCase()}_upsert_${index}`
      return { filename, info }
    })

    const serviceExports = this.renderServices()
    const servicesWithFilenames = serviceExports.map((svc) => {
      // Service filename: pck_app -> pck_app
      const filename = svc.name.toLowerCase()
      return { filename, info: svc }
    })

    const schemaExport: MultiFileSchemaExport = {
      schema: this.name.toUpperCase(),
      exported: currentTimestamp,
      tables: tablesWithFilenames,
      ...(upsertsWithFilenames.length > 0 && { upserts: upsertsWithFilenames }),
      ...(servicesWithFilenames.length > 0 && { services: servicesWithFilenames }),
    }

    return JSON.stringify(schemaExport, null, 2)
  }

  /**
   * Render services - combines explicit services with methods grouped by package
   */
  private renderServices(): ServiceExport[] {
    const allServices: ServiceExport[] = []

    // First, add all explicit services
    for (const service of this.services) {
      allServices.push(service.toServiceInfo())
    }

    // Then, group loose methods by package name and create implicit services
    const packageMap = new Map<string, Method[]>()

    for (const method of this.methods) {
      const pkgName = method.getPackageName()
      if (!pkgName) continue

      const fullPkgName = `pck_${pkgName}`

      // Skip if this package is already covered by an explicit service
      if (allServices.some((s) => s.name === fullPkgName)) continue

      if (!packageMap.has(fullPkgName)) {
        packageMap.set(fullPkgName, [])
      }
      packageMap.get(fullPkgName)!.push(method)
    }

    // Create implicit services from grouped methods
    for (const [pkgName, methods] of packageMap) {
      const methodInfos = methods.map((m) => m.toMethodInfo())

      allServices.push({
        name: pkgName,
        editionable: true,
        authid: 'DEFINER',
        methods: methodInfos,
      })
    }

    return allServices
  }

  toObject(): SchemaExport {
    const tableInfos: TableInfo[] = this.tables.map((table) => table.toTableInfo())
    const upsertInfos: UpsertInfo[] = this.upserts.map((upsert) => upsert.toObject())
    const serviceExports = this.renderServices()

    return {
      schema: this.name.toUpperCase(),
      exported: new Date().toISOString(),
      tables: tableInfos,
      ...(upsertInfos.length > 0 && { upserts: upsertInfos }),
      ...(serviceExports.length > 0 && { services: serviceExports }),
    }
  }

  toJson(): string {
    return JSON.stringify(this.toObject(), null, 2)
  }

  /**
   * Collect all SQL statements from tables
   * Returns array of statements organized by type
   */
  toSql(): SqlStatement[] {
    const statements: SqlStatement[] = []

    for (const table of this.tables) {
      statements.push(...table.toSql())
    }

    return statements
  }

  getSchemaName(): string {
    return this.name.toUpperCase()
  }

  getTables(): Entity[] {
    return this.tables
  }

  getUpserts(): Upsert[] {
    return this.upserts
  }

  getMethods(): Method[] {
    return this.methods
  }

  getServices(): Service[] {
    return this.services
  }
}
