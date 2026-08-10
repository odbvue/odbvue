import { describe, expect, it } from 'vitest'

import { defineMigration } from '../src/migration.js'
import {
  migrationMetadataSql,
  ODB_MIGRATIONS_TABLE,
  ODB_MIGRATION_OBJECTS_TABLE,
} from '../src/migration-metadata.js'
import { planMigrations, type MigrationCatalogEntry } from '../src/migration-planner.js'
import { odbPackage } from '../src/schema/package.js'

const migrations: MigrationCatalogEntry[] = [
  { id: '20260601000000_users', tag: '1.0.0' },
  { id: '20260602000000_users' },
  { id: '20260603000000_orders', tag: '1.1.0' },
]

describe('migration planner', () => {
  it('preserves an inline migration tag', () => {
    expect(
      defineMigration('20260601000000_initial', { schema: 'APP', tag: '1.0.0' }).compile().tag,
    ).toBe('1.0.0')
  })

  it('defines ODB-owned migration metadata tables', () => {
    const sql = migrationMetadataSql('APP').join('\n')

    expect(sql).toContain(`CREATE TABLE APP.${ODB_MIGRATIONS_TABLE}`)
    expect(sql).toContain(`CREATE TABLE APP.${ODB_MIGRATION_OBJECTS_TABLE}`)
  })

  it('uses the ODB-owned registry for blue-green objects', () => {
    const pkg = odbPackage('pck_test', (definition) => {
      definition.proc('run', (procedure) => procedure.body(() => {}))
    })
    const migration = defineMigration('20260601000000_test', { schema: 'APP' })
      .install(pkg)
      .compile()

    expect(migration.up().join('\n')).toContain(`APP.${ODB_MIGRATION_OBJECTS_TABLE}`)
  })

  it('moves one migration when no target is provided', () => {
    expect(planMigrations(migrations, [], { direction: 'up' }).steps).toEqual([
      { ...migrations[0], direction: 'up' },
    ])

    expect(
      planMigrations(
        migrations,
        migrations.map((migration) => migration.id),
        {
          direction: 'down',
        },
      ).steps,
    ).toEqual([{ ...migrations[2], direction: 'down' }])
  })

  it('plans all migrations through a tag', () => {
    const plan = planMigrations(migrations, [], { direction: 'up', target: '1.1.0' })

    expect(plan.direction).toBe('up')
    expect(plan.targetId).toBe('20260603000000_orders')
    expect(plan.steps.map((step) => step.id)).toEqual(migrations.map((migration) => migration.id))
  })

  it('leaves the target tag applied when moving down', () => {
    const plan = planMigrations(
      migrations,
      migrations.map((migration) => migration.id),
      { direction: 'down', target: '1.0.0' },
    )

    expect(plan.steps.map((step) => step.id)).toEqual([
      '20260603000000_orders',
      '20260602000000_users',
    ])
  })

  it('infers direction for a target-only plan', () => {
    expect(planMigrations(migrations, [migrations[0].id], { target: 'latest' }).direction).toBe(
      'up',
    )
    expect(
      planMigrations(migrations, [migrations[0].id, migrations[1].id], { target: 'base' })
        .direction,
    ).toBe('down')
  })

  it('returns an empty plan at a boundary or reached target', () => {
    expect(planMigrations(migrations, [], { direction: 'down' }).steps).toEqual([])
    expect(planMigrations(migrations, [], { target: 'base' }).direction).toBeNull()
  })

  it('rejects targets in the wrong direction', () => {
    expect(() =>
      planMigrations(migrations, [migrations[0].id, migrations[1].id], {
        direction: 'up',
        target: 'base',
      }),
    ).toThrow('behind the current migration')
  })

  it('rejects applied migrations that are not a local prefix', () => {
    expect(() => planMigrations(migrations, [migrations[1].id], { direction: 'up' })).toThrow(
      'does not match local migration',
    )
  })

  it('rejects unknown and duplicate tags', () => {
    expect(() => planMigrations(migrations, [], { target: '2.0.0' })).toThrow(
      'Unknown migration target',
    )
    expect(() =>
      planMigrations(
        [
          { id: 'one', tag: '1.0.0' },
          { id: 'two', tag: '1.0.0' },
        ],
        [],
        { direction: 'up' },
      ),
    ).toThrow('Duplicate migration tag')
  })

  it('rejects reserved tags', () => {
    expect(() => planMigrations([{ id: 'one', tag: 'latest' }], [], { direction: 'up' })).toThrow(
      'reserved tag',
    )
  })
})
