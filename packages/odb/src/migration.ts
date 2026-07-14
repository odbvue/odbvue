import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import { Column, emitColumnDef, type ColumnOptions, type ColumnType } from './schema/column.js'
import { odbOrdsSchema } from './ords.js'
import { type Schema } from './schema/schema.js'
import { type Table } from './schema/table.js'

export type MigrationDefinition = {
  name: string
  schema?: string
  version?: string
  edition?: string
  up: () => string | string[]
  down: () => string | string[]
}

export type MigrationOptions = {
  schema: string
  version: string
  /**
   * `ensure` creates the derived edition when missing, grants the schema use,
   * and selects it. `use` only selects it. `none` disables edition handling.
   * Defaults to `ensure`.
   */
  edition?: 'ensure' | 'use' | 'none'
}

export type MigrationSqlArtifact = {
  toSQLUp(options?: { schema?: string }): string
  toSQLDown(options?: { schema?: string }): string
}

export type MigrationServiceArtifact = {
  toOrdsSQL(options?: { schema?: string }): string
  toOrdsDownSQL(options?: { schema?: string }): string
}

type MigrationOperationKind = 'install' | 'uninstall' | 'expose' | 'unexpose'

export type MigrationOperation = {
  readonly kind: MigrationOperationKind
  readonly sql: string
}

export type MigrationContext = {
  readonly schema: string
  readonly version?: string
  readonly edition?: string
}

export type MigrationUpContext = MigrationContext & {
  install(artifact: MigrationSqlArtifact): MigrationOperation
  expose(artifact: MigrationServiceArtifact): MigrationOperation
}

export type MigrationDownContext = MigrationContext & {
  uninstall(artifact: MigrationSqlArtifact): MigrationOperation
  unexpose(artifact: MigrationServiceArtifact): MigrationOperation
}

type InternalMigrationContext = MigrationUpContext & MigrationDownContext

type MigrationOutput = string | MigrationOperation | Array<string | MigrationOperation>

function validateSchema(schema: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_$#]*$/.test(schema)) {
    throw new Error(`Invalid Oracle schema name: ${schema}`)
  }
  return schema.toUpperCase()
}

function deriveEditionName(schema: string, version: string): string {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid version format: ${version}. Expected format: x.y.z`)
  }
  return `${schema}_${version.replaceAll('.', '_')}`
}

function ensureEditionSql(edition: string, schema: string): string {
  return [
    'DECLARE',
    '  v_count PLS_INTEGER;',
    'BEGIN',
    `  SELECT COUNT(*) INTO v_count FROM all_editions WHERE edition_name = '${edition}';`,
    '  IF v_count = 0 THEN',
    `    EXECUTE IMMEDIATE 'CREATE EDITION ${edition}';`,
    '  END IF;',
    `  EXECUTE IMMEDIATE 'GRANT USE ON EDITION ${edition} TO ${schema}';`,
    'END;',
    '/',
  ].join('\n')
}

function editionPrelude(direction: 'up' | 'down', options?: MigrationOptions): string[] {
  if (!options || options.edition === 'none') return []

  const schema = validateSchema(options.schema)
  const edition = deriveEditionName(schema, options.version)
  const sql: string[] = []
  if (direction === 'up' && (options.edition ?? 'ensure') === 'ensure') {
    sql.push(ensureEditionSql(edition, schema))
  }
  sql.push(`ALTER SESSION SET EDITION = ${edition};`)
  return sql
}

function createMigrationContext(options?: MigrationOptions): InternalMigrationContext {
  const schema = options ? validateSchema(options.schema) : ''
  const edition =
    options && options.edition !== 'none' ? deriveEditionName(schema, options.version) : undefined
  const requireSchema = (): string => {
    if (!schema) {
      throw new Error(
        'Migration lifecycle helpers require defineMigration(name, { schema, version }).',
      )
    }
    return schema
  }

  return {
    schema,
    version: options?.version,
    edition,
    install: (artifact) => ({
      kind: 'install',
      sql: artifact.toSQLUp({ schema: requireSchema() }),
    }),
    uninstall: (artifact) => ({
      kind: 'uninstall',
      sql: artifact.toSQLDown({ schema: requireSchema() }),
    }),
    expose: (artifact) => ({
      kind: 'expose',
      sql: artifact.toOrdsSQL({ schema: requireSchema() }),
    }),
    unexpose: (artifact) => ({
      kind: 'unexpose',
      sql: artifact.toOrdsDownSQL({ schema: requireSchema() }),
    }),
  }
}

function resolveMigrationOutput(
  direction: 'up' | 'down',
  output: MigrationOutput,
  options?: MigrationOptions,
): string[] {
  const values = Array.isArray(output) ? output : [output]
  const order: Record<MigrationOperationKind, number> =
    direction === 'up'
      ? { install: 10, expose: 20, unexpose: 30, uninstall: 40 }
      : { unexpose: 10, uninstall: 20, install: 30, expose: 40 }
  const lastMajorIndex = values.reduce((last, value, index) => {
    if (typeof value === 'string') return last
    const majorKind = direction === 'up' ? 'expose' : 'uninstall'
    return value.kind === majorKind ? index : last
  }, -1)
  const ordered = values
    .map((value, index) => ({
      index,
      phase:
        typeof value === 'string'
          ? lastMajorIndex >= 0 && index > lastMajorIndex
            ? 25
            : 15
          : order[value.kind],
      kind: typeof value === 'string' ? undefined : value.kind,
      sql: typeof value === 'string' ? value : value.sql,
    }))
    .toSorted((a, b) => a.phase - b.phase || a.index - b.index)
  const sql = [...editionPrelude(direction, options)]

  if (direction === 'up' && ordered.some((entry) => entry.kind === 'expose')) {
    const firstExpose = ordered.findIndex((entry) => entry.kind === 'expose')
    const beforeExpose = ordered.slice(0, firstExpose).map((entry) => entry.sql)
    const fromExpose = ordered.slice(firstExpose).map((entry) => entry.sql)
    sql.push(
      ...beforeExpose,
      odbOrdsSchema(validateSchema(options!.schema)).toSQLUp(),
      ...fromExpose,
    )
  } else {
    sql.push(...ordered.map((entry) => entry.sql))
  }

  return sql.filter(Boolean)
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
  private _up: (context: MigrationUpContext) => MigrationOutput = () => []
  private _down: (context: MigrationDownContext) => MigrationOutput = () => []

  constructor(
    private readonly _name: string,
    private readonly _options?: MigrationOptions,
    private readonly _legacyVersion?: string,
  ) {}

  up(fn: (context: MigrationUpContext) => MigrationOutput): this {
    this._up = fn
    return this
  }

  down(fn: (context: MigrationDownContext) => MigrationOutput): this {
    this._down = fn
    return this
  }

  compile(): MigrationDefinition {
    const context = createMigrationContext(this._options)
    return {
      name: this._name,
      schema: context.schema || undefined,
      version: this._options?.version ?? this._legacyVersion,
      edition: context.edition,
      up: () => resolveMigrationOutput('up', this._up(context), this._options),
      down: () => resolveMigrationOutput('down', this._down(context), this._options),
    }
  }
}

export function defineMigration(name: string, version?: string): MigrationBuilder
export function defineMigration(name: string, options: MigrationOptions): MigrationBuilder
export function defineMigration(
  name: string,
  optionsOrVersion?: MigrationOptions | string,
): MigrationBuilder {
  return typeof optionsOrVersion === 'string' || optionsOrVersion === undefined
    ? new MigrationBuilder(name, undefined, optionsOrVersion)
    : new MigrationBuilder(name, optionsOrVersion)
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
