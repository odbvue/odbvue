import type { TableInfo } from './table.js'
import { Table } from './table.js'

export type SchemaExport = {
  schema: string
  exported: string
  tables: TableInfo[]
}

export type MultiFileSchemaExport = {
  schema: string
  exported: string
  tables: Array<{
    filename: string
    info: TableInfo
  }>
}

export class Schema {
  private name: string
  private tables: Table[] = []

  constructor(name: string) {
    this.name = name
  }

  addTable(table: Table): this {
    this.tables.push(table)
    return this
  }

  addTables(tables: Table[]): this {
    this.tables.push(...tables)
    return this
  }

  /**
   * Render as single JSON string (legacy format)
   */
  render(): string {
    const currentTimestamp = new Date().toISOString()

    const tableInfos: TableInfo[] = this.tables.map((table) => table.toTableInfo())

    const schemaExport: SchemaExport = {
      schema: this.name.toUpperCase(),
      exported: currentTimestamp,
      tables: tableInfos,
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

    const schemaExport: MultiFileSchemaExport = {
      schema: this.name.toUpperCase(),
      exported: currentTimestamp,
      tables: tablesWithFilenames,
    }

    return JSON.stringify(schemaExport, null, 2)
  }

  getSchemaName(): string {
    return this.name.toUpperCase()
  }

  getTables(): Table[] {
    return this.tables
  }
}
