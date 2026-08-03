import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'

import { Column, emitColumnDef, type ColumnOptions, type ColumnType } from './schema/column.js'
import { odbOrdsSchema, type OrdsEndpoint } from './ords.js'
import { type Schema } from './schema/schema.js'
import { type Table } from './schema/table.js'
import type { AnyQueryBuilder } from './schema/package.js'

/** Registry table tracking the active blue/green color per deployed object. */
export const BLUE_GREEN_REGISTRY_TABLE = 'app_migrations_objects'

export type BlueGreenColor = 'BLUE' | 'GREEN'

/** Per-object deployment decision computed across the ordered migration set. */
export type BlueGreenPlanEntry = {
  /** Color this migration deploys the object to (the idle copy). */
  color: BlueGreenColor
  /** Color the previous version lives on; used to revert on `down`. */
  previousColor?: BlueGreenColor
  /** True when this is the object's first install (no previous color). */
  first: boolean
}

export type BlueGreenPlan = Map<string, BlueGreenPlanEntry>

/**
 * An install artifact deployed via blue/green: created under a colored physical
 * name behind a stable synonym so live callers are never blocked by a recompile.
 */
export interface BlueGreenArtifact extends MigrationSqlArtifact {
  readonly isBlueGreen: true
  /** Public (synonym) name that callers reference. */
  readonly objectName: string
  toSQLUp(options?: { schema?: string; physicalName?: string }): string
  toSQLDown(options?: { schema?: string; physicalName?: string }): string
}

function isBlueGreenArtifact(artifact: unknown): artifact is BlueGreenArtifact {
  return (
    typeof artifact === 'object' &&
    artifact !== null &&
    (artifact as { isBlueGreen?: unknown }).isBlueGreen === true
  )
}

function isServiceArtifact(artifact: unknown): artifact is MigrationServiceArtifact {
  return (
    typeof artifact === 'object' &&
    artifact !== null &&
    typeof (artifact as { toOrdsSQL?: unknown }).toOrdsSQL === 'function'
  )
}

/**
 * True when a service artifact actually declares endpoints. Artifacts that can
 * expose services but currently declare none are not auto-published.
 */
function hasServiceEndpoints(artifact: MigrationServiceArtifact): boolean {
  const maybe = artifact as { hasOrdsEndpoints?: () => boolean }
  return typeof maybe.hasOrdsEndpoints === 'function' ? maybe.hasOrdsEndpoints() : true
}

/** Apply the migration schema to a query builder that supports deferred qualification. */
function applyQuerySchema<T extends AnyQueryBuilder>(query: T, schema: string): T {
  const maybe = query as { resolveSchema?: (s: string) => unknown }
  if (typeof maybe.resolveSchema === 'function') maybe.resolveSchema(schema)
  return query
}

export type MigrationOptions = {
  schema: string
}

export type MigrationDefinition = {
  name: string
  schema: string
  /** Public names of blue/green artifacts installed by this migration. */
  blueGreenObjects: string[]
  up: (plan?: BlueGreenPlan) => string[]
  down: (plan?: BlueGreenPlan) => string[]
}

export type MigrationSqlArtifact = {
  toSQLUp(options?: { schema?: string }): string
  toSQLDown(options?: { schema?: string }): string
}

export type MigrationServiceArtifact = {
  toOrdsSQL(options?: { schema?: string }): string
  toOrdsDownSQL(options?: { schema?: string }): string
  ordsEndpoints?(): OrdsEndpoint[]
}

function validateSchema(schema: string): string {
  if (!/^[A-Za-z][A-Za-z0-9_$#]*$/.test(schema)) {
    throw new Error(`Invalid Oracle schema name: ${schema}`)
  }
  return schema.toUpperCase()
}

/** Colored physical object name, e.g. `PCK_APP` + `BLUE` → `PCK_APP_BLUE`. */
function physicalName(objectName: string, color: BlueGreenColor): string {
  return `${objectName.toUpperCase()}_${color}`
}

/** Repoint the stable synonym at the colored physical object. */
function synonymSwapSql(schema: string, publicName: string, physical: string): string {
  return `CREATE OR REPLACE SYNONYM ${schema}.${publicName} FOR ${schema}.${physical};`
}

/** Drop the synonym, tolerating a missing synonym (ORA-01434 / ORA-01432). */
function synonymDropSql(schema: string, publicName: string): string {
  return [
    `BEGIN`,
    `  EXECUTE IMMEDIATE 'DROP SYNONYM ${schema}.${publicName}';`,
    `EXCEPTION WHEN OTHERS THEN`,
    `  IF SQLCODE NOT IN (-1434, -1432) THEN RAISE; END IF;`,
    `END;`,
    `/`,
  ].join('\n')
}

/** Upsert the active color for an object into the registry table. */
function registryMergeSql(
  schema: string,
  objectName: string,
  objectType: string,
  color: BlueGreenColor,
  migrationName: string,
): string {
  const table = `${schema}.${BLUE_GREEN_REGISTRY_TABLE}`
  const name = objectName.toUpperCase()
  return [
    `MERGE INTO ${table} t`,
    `USING (SELECT '${name}' AS object_name FROM dual) s`,
    `ON (t.object_name = s.object_name)`,
    `WHEN MATCHED THEN UPDATE SET`,
    `  t.object_type = '${objectType}',`,
    `  t.active_color = '${color}',`,
    `  t.migration_name = '${migrationName}',`,
    `  t.updated = SYSTIMESTAMP`,
    `WHEN NOT MATCHED THEN`,
    `  INSERT (object_name, object_type, active_color, migration_name)`,
    `  VALUES ('${name}', '${objectType}', '${color}', '${migrationName}');`,
  ].join('\n')
}

/** Remove an object from the registry (first-install rollback). */
function registryDeleteSql(schema: string, objectName: string): string {
  return `DELETE FROM ${schema}.${BLUE_GREEN_REGISTRY_TABLE} WHERE object_name = '${objectName.toUpperCase()}';`
}

/** Resolve the deployment decision for an object, defaulting to a first BLUE install. */
function resolvePlanEntry(plan: BlueGreenPlan | undefined, objectName: string): BlueGreenPlanEntry {
  return plan?.get(objectName) ?? { color: 'BLUE', first: true }
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
  private readonly _upQueries: AnyQueryBuilder[] = []
  private readonly _downQueries: AnyQueryBuilder[] = []

  constructor(
    private readonly _name: string,
    private readonly _options: MigrationOptions,
  ) {}

  /** Install a schema artifact (schema, table, package, pre-built api). */
  install(artifact: MigrationSqlArtifact): this {
    this._installs.push(artifact)
    // Auto-publish ORDS endpoints declared on installed service artifacts
    // (e.g. a package whose procedures call `.service(...)`), so authors no
    // longer need a separate `.expose()` call. Explicit `.expose()` still works
    // and is deduped.
    if (isServiceArtifact(artifact) && hasServiceEndpoints(artifact)) {
      this.expose(artifact)
    }
    return this
  }

  /** Publish the ORDS endpoints declared by a service artifact (e.g. a package). */
  expose(artifact: MigrationServiceArtifact): this {
    if (!this._exposes.includes(artifact)) {
      this._exposes.push(artifact)
    }
    return this
  }

  /** Collect the ORDS endpoints exposed by this migration's service artifacts. */
  ordsEndpoints(): OrdsEndpoint[] {
    return this._exposes.flatMap((a) => a.ordsEndpoints?.() ?? [])
  }

  /** Escape hatch: raw SQL appended to `up` after installs, before exposes. */
  upRaw(sql: string | string[]): this {
    this._upRaw.push(...(Array.isArray(sql) ? sql : [sql]))
    return this
  }

  /** Escape hatch: raw SQL run in `down` before uninstalls. */
  downRaw(sql: string | string[]): this {
    this._downRaw.push(...(Array.isArray(sql) ? sql : [sql]))
    return this
  }

  /** Execute a query builder statement during `up`. */
  upQuery(query: AnyQueryBuilder): this {
    this._upQueries.push(query)
    return this
  }

  /** Execute a query builder statement during `down`. */
  downQuery(query: AnyQueryBuilder): this {
    this._downQueries.push(query)
    return this
  }

  compile(): MigrationDefinition {
    const schema = validateSchema(this._options.schema)
    const migrationName = this._name

    const blueGreenObjects = this._installs.filter(isBlueGreenArtifact).map((a) => a.objectName)

    const up = (plan?: BlueGreenPlan): string[] => {
      const sql: string[] = []
      for (const artifact of this._installs) {
        if (isBlueGreenArtifact(artifact)) {
          const entry = resolvePlanEntry(plan, artifact.objectName)
          const physical = physicalName(artifact.objectName, entry.color)
          sql.push(artifact.toSQLUp({ schema, physicalName: physical }))
          sql.push(synonymSwapSql(schema, artifact.objectName, physical))
          sql.push(
            registryMergeSql(schema, artifact.objectName, 'PACKAGE', entry.color, migrationName),
          )
        } else {
          sql.push(artifact.toSQLUp({ schema }))
        }
      }
      sql.push(...this._upRaw)
      sql.push(...this._upQueries.map((q) => applyQuerySchema(q, schema).toSQL()))
      if (this._exposes.length) {
        sql.push(odbOrdsSchema(schema).toSQLUp())
        sql.push(...this._exposes.map((a) => a.toOrdsSQL({ schema })))
      }
      return sql.filter(Boolean)
    }

    const down = (plan?: BlueGreenPlan): string[] => {
      const sql: string[] = []
      if (this._exposes.length) {
        sql.push(...this._exposes.toReversed().map((a) => a.toOrdsDownSQL({ schema })))
      }
      sql.push(...this._downRaw)
      sql.push(...this._downQueries.map((q) => applyQuerySchema(q, schema).toSQL()))
      for (const artifact of this._installs.toReversed()) {
        if (isBlueGreenArtifact(artifact)) {
          const entry = resolvePlanEntry(plan, artifact.objectName)
          const physical = physicalName(artifact.objectName, entry.color)
          if (entry.first || !entry.previousColor) {
            sql.push(synonymDropSql(schema, artifact.objectName))
            sql.push(artifact.toSQLDown({ schema, physicalName: physical }))
            sql.push(registryDeleteSql(schema, artifact.objectName))
          } else {
            const previous = physicalName(artifact.objectName, entry.previousColor)
            sql.push(synonymSwapSql(schema, artifact.objectName, previous))
            sql.push(artifact.toSQLDown({ schema, physicalName: physical }))
            sql.push(
              registryMergeSql(
                schema,
                artifact.objectName,
                'PACKAGE',
                entry.previousColor,
                migrationName,
              ),
            )
          }
        } else {
          sql.push(artifact.toSQLDown({ schema }))
        }
      }
      return sql.filter(Boolean)
    }

    return {
      name: migrationName,
      schema,
      blueGreenObjects,
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

  // Deterministic blue/green color per object, alternating on each install in
  // migration order. The k-th install of an object lands on the idle color
  // (BLUE for odd k, GREEN for even k); the previous version stays on the
  // opposite color for instant rollback via a synonym swap.
  const installCounts = new Map<string, number>()

  for (let i = 0; i < compiled.length; i++) {
    const mig = compiled[i]

    const plan: BlueGreenPlan = new Map()
    for (const objectName of mig.blueGreenObjects) {
      const k = (installCounts.get(objectName) ?? 0) + 1
      installCounts.set(objectName, k)
      const color: BlueGreenColor = k % 2 === 1 ? 'BLUE' : 'GREEN'
      const previousColor: BlueGreenColor | undefined =
        k === 1 ? undefined : color === 'BLUE' ? 'GREEN' : 'BLUE'
      plan.set(objectName, { color, previousColor, first: k === 1 })
    }

    const upPath = path.join(sqlOutputDir, `${mig.name}_up.sql`)
    const downPath = path.join(sqlOutputDir, `${mig.name}_down.sql`)
    result.push(upPath, downPath)

    fs.writeFileSync(upPath, `${emitMigrationSql(mig.up(plan))}\n`, 'utf8')
    fs.writeFileSync(downPath, `${emitMigrationSql(mig.down(plan))}\n`, 'utf8')
  }

  return result
}
