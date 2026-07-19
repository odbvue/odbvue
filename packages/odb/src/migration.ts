import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import { Column, emitColumnDef, type ColumnOptions, type ColumnType } from './schema/column.js'
import { odbEdition } from './editions.js'
import { odbOrdsSchema } from './ords.js'
import { type Schema } from './schema/schema.js'
import { type Table } from './schema/table.js'

export type MigrationOptions = {
  schema: string
  version: string
  /**
   * `ensure` (default) derives an edition from `schema`/`version`, creates it
   * when missing, selects it, grants the schema use, and makes it the default.
   * `none` disables all edition handling.
   */
  edition?: 'ensure' | 'none'
}

export type MigrationDefinition = {
  name: string
  schema: string
  version: string
  edition?: string
  up: () => string[]
  down: (previousVersion?: string) => string[]
}

export type MigrationSqlArtifact = {
  toSQLUp(options?: { schema?: string }): string
  toSQLDown(options?: { schema?: string }): string
}

export type MigrationServiceArtifact = {
  toOrdsSQL(options?: { schema?: string }): string
  toOrdsDownSQL(options?: { schema?: string }): string
}

function validateSchema(schema: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_$#]*$/.test(schema)) {
    throw new Error(`Invalid Oracle schema name: ${schema}`)
  }
  return schema.toUpperCase()
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
  private readonly _installs: MigrationSqlArtifact[] = []
  private readonly _exposes: MigrationServiceArtifact[] = []
  private readonly _upRaw: string[] = []
  private readonly _downRaw: string[] = []

  constructor(
    private readonly _name: string,
    private readonly _options: MigrationOptions,
  ) {}

  /** Install a schema artifact (schema, table, package, pre-built api). */
  install(artifact: MigrationSqlArtifact): this {
    this._installs.push(artifact)
    return this
  }

  /** Publish the ORDS endpoints declared by a service artifact (e.g. a package). */
  expose(artifact: MigrationServiceArtifact): this {
    this._exposes.push(artifact)
    return this
  }

  /** Escape hatch: raw SQL appended to `up` after installs, before exposes. */
  upRaw(sql: string | string[]): this {
    this._upRaw.push(...(Array.isArray(sql) ? sql : [sql]))
    return this
  }

  /** Escape hatch: raw SQL run in `down` after edition setup, before uninstalls. */
  downRaw(sql: string | string[]): this {
    this._downRaw.push(...(Array.isArray(sql) ? sql : [sql]))
    return this
  }

  compile(): MigrationDefinition {
    const schema = validateSchema(this._options.schema)
    const version = this._options.version
    const edition =
      (this._options.edition ?? 'ensure') === 'none' ? undefined : new odbEdition(version, schema)

    const up = (): string[] => {
      const sql: string[] = []
      if (edition) {
        sql.push(edition.ensureCreated(), edition.setCurrent())
      }
      sql.push(...this._installs.map((a) => a.toSQLUp({ schema })))
      sql.push(...this._upRaw)
      if (edition) sql.push(edition.grantUse())
      if (this._exposes.length) {
        sql.push(odbOrdsSchema(schema).toSQLUp())
        sql.push(...this._exposes.map((a) => a.toOrdsSQL({ schema })))
      }
      if (edition) sql.push(edition.setDefault())
      return sql.filter(Boolean)
    }

    const down = (previousVersion?: string): string[] => {
      const previous =
        edition && previousVersion ? new odbEdition(previousVersion, schema) : undefined
      const sql: string[] = []
      if (edition) {
        sql.push(edition.setCurrent())
        sql.push(previous ? previous.setDefault() : edition.setDefaultBase())
      }
      if (this._exposes.length) {
        sql.push(...this._exposes.toReversed().map((a) => a.toOrdsDownSQL({ schema })))
      }
      sql.push(...this._downRaw)
      sql.push(...this._installs.toReversed().map((a) => a.toSQLDown({ schema })))
      if (edition) {
        sql.push(previous ? previous.setCurrent() : edition.setBase())
        sql.push(edition.drop({ cascade: true }))
      }
      return sql.filter(Boolean)
    }

    return {
      name: this._name,
      schema,
      version,
      edition: edition?.name,
      up,
      down,
    }
  }
}

export function defineMigration(name: string, options: MigrationOptions): MigrationBuilder {
  return new MigrationBuilder(name, options)
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
  const entries = fs
    .readdirSync(migrationsSourceDir)
    .filter((e) => e.endsWith('.js'))
    .toSorted()

  const compiled: MigrationDefinition[] = []
  for (const entry of entries) {
    const migrationPath = path.join(migrationsSourceDir, entry)
    const mod = await import(pathToFileURL(migrationPath).href)
    compiled.push((mod.migration as MigrationBuilder).compile())
  }

  for (let i = 0; i < compiled.length; i++) {
    const mig = compiled[i]
    const previousVersion = i > 0 ? compiled[i - 1].version : undefined

    const upPath = path.join(sqlOutputDir, `${mig.name}_up.sql`)
    const downPath = path.join(sqlOutputDir, `${mig.name}_down.sql`)
    result.push(upPath, downPath)

    fs.writeFileSync(upPath, `${emitMigrationSql(mig.up())}\n`, 'utf8')
    fs.writeFileSync(downPath, `${emitMigrationSql(mig.down(previousVersion))}\n`, 'utf8')
  }

  return result
}
