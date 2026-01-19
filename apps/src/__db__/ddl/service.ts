import type { MethodInfo } from './method.js'
import { Method } from './method.js'

export type ServiceOptions = {
  editionable?: boolean
  authid?: 'DEFINER' | 'CURRENT_USER'
}

export type ServiceInfo = {
  name: string
  editionable: boolean
  authid: 'DEFINER' | 'CURRENT_USER'
  methods: MethodInfo[]
}

export class Service {
  private serviceName: string
  private options: ServiceOptions
  private methods: Method[] = []

  constructor(name: string, options: ServiceOptions = {}) {
    this.serviceName = name
    this.options = {
      editionable: options.editionable ?? true,
      authid: options.authid ?? 'DEFINER',
    }
  }

  /**
   * Add a method to this service
   */
  addMethod(method: Method): this {
    this.methods.push(method)
    return this
  }

  /**
   * Add multiple methods to this service
   */
  addMethods(methods: Method[]): this {
    this.methods.push(...methods)
    return this
  }

  /**
   * Set editionable option
   */
  editionable(value: boolean): this {
    this.options.editionable = value
    return this
  }

  /**
   * Set authid option
   */
  authid(value: 'DEFINER' | 'CURRENT_USER'): this {
    this.options.authid = value
    return this
  }

  /**
   * Get the service name
   */
  getName(): string {
    return this.serviceName
  }

  /**
   * Get methods
   */
  getMethods(): Method[] {
    return this.methods
  }

  /**
   * Get service info for JSON export (without SQL generation)
   */
  toServiceInfo(): ServiceInfo {
    return {
      name: this.serviceName,
      editionable: this.options.editionable ?? true,
      authid: this.options.authid ?? 'DEFINER',
      methods: this.methods.map((m) => m.toMethodInfo()),
    }
  }

  /**
   * Render package specification SQL
   */
  renderSpec(): string {
    const editionable = this.options.editionable ? 'EDITIONABLE ' : ''
    const authid = this.options.authid ? ` AUTHID ${this.options.authid}` : ''

    let sql = `CREATE OR REPLACE ${editionable}PACKAGE ${this.serviceName}${authid} AS\n\n`
    for (const method of this.methods) {
      sql += method.renderSpec()
    }
    sql += `END ${this.serviceName};\n/\n`
    return sql
  }

  /**
   * Render package body SQL
   */
  renderBody(): string {
    const editionable = this.options.editionable ? 'EDITIONABLE ' : ''

    let sql = `CREATE OR REPLACE ${editionable}PACKAGE BODY ${this.serviceName} AS\n\n`
    for (const method of this.methods) {
      sql += method.renderBody()
    }
    sql += `END ${this.serviceName};\n/\n`
    return sql
  }
}
