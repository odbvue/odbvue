import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import { Column, emitColumnDef, type ColumnOptions, type ColumnType } from './schema/column.js'
import { type Schema } from './schema/schema.js'
import { type Table } from './schema/table.js'

export type MigrationDefinition = {
  name: string
  up: () => string | string[]
  down: () => string | string[]
}

export class AlterTableBuilder {
  private readonly _ops: string[] = []
  private readonly _qualified: string

  constructor(table: string, schema?: string) {
    this._qualified = schema ? `${schema}.${table}` : table
  }

  addColumn(name: string, type: ColumnType, options: ColumnOptions = {}): this {
    const node = new Column(name, type, options).toNode()
    this._ops.push(`ALTER TABLE ${this._qualified} ADD (${emitColumnDef(node)});`)
    return this
  }

  dropColumn(name: string): this {
    this._ops.push(`ALTER TABLE ${this._qualified} DROP COLUMN ${name};`)
    return this
  }

  compile(): string[] {
    return [...this._ops]
  }
}

export class MigrationBuilder {
  private _up: () => string | string[] = () => []
  private _down: () => string | string[] = () => []

  constructor(
    private readonly _name: string,
    private readonly _version?: string,
  ) {}

  up(fn: () => string | string[]): this {
    this._up = fn
    return this
  }

  down(fn: () => string | string[]): this {
    this._down = fn
    return this
  }

  compile(): MigrationDefinition {
    return {
      name: this._name,
      up: this._up,
      down: this._down,
    }
  }
}

export function defineMigration(name: string, version?: string): MigrationBuilder {
  return new MigrationBuilder(name, version)
}

export function alterTable(table: Table | string, schema?: Schema | string): AlterTableBuilder {
  const tableName = typeof table === 'string' ? table : table.name
  const schemaStr = typeof schema === 'string' ? schema : schema?.username
  return new AlterTableBuilder(tableName, schemaStr)
}

export type MigrationSqlOptions = {
  headerComments?: string[]
}

export function emitMigrationSql(
  sql: string | string[],
  options: MigrationSqlOptions = {},
): string {
  const sections: string[] = []
  if (options.headerComments?.length) {
    sections.push(options.headerComments.map((l) => `-- ${l}`).join('\n'))
  }
  const body = Array.isArray(sql) ? sql : [sql]
  sections.push(...body.filter(Boolean))
  return sections.join('\n\n')
}

export async function generateMigrationsFromCompiledModules(
  migrationsSourceDir: string,
  sqlOutputDir: string,
): Promise<string[]> {
  fs.mkdirSync(sqlOutputDir, { recursive: true })

  for (const entry of fs.readdirSync(sqlOutputDir)) {
    if (/^\d+_.*\.(up|down)\.sql$/.test(entry)) {
      fs.rmSync(path.join(sqlOutputDir, entry), { force: true })
    }
  }

  const result: string[] = []
  const entries = fs.readdirSync(migrationsSourceDir).filter((e) => e.endsWith('.js'))

  for (const entry of entries) {
    const migrationPath = path.join(migrationsSourceDir, entry)
    const mod = await import(pathToFileURL(migrationPath).href)
    const mig = (mod.migration as MigrationBuilder).compile()

    const upPath = path.join(sqlOutputDir, `${mig.name}_up.sql`)
    const downPath = path.join(sqlOutputDir, `${mig.name}_down.sql`)
    result.push(upPath, downPath)

    fs.writeFileSync(upPath, `${emitMigrationSql(mig.up())}\n`, 'utf8')
    fs.writeFileSync(downPath, `${emitMigrationSql(mig.down())}\n`, 'utf8')
  }

  return result
}
