import type { TableInfo } from './table.js'
import { Table } from './table.js'

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

  render(): string {
    const currentTimestamp = new Date().toISOString()

    const tableInfos: TableInfo[] = this.tables.map((table) => table.toTableInfo())

    const schemaExport = {
      schema: this.name.toUpperCase(),
      exported: currentTimestamp,
      tables: tableInfos,
    }

    return JSON.stringify(schemaExport, null, 2)
  }
}
