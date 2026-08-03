import { describe, expect, expectTypeOf, it } from 'vitest'
import { Column } from '../../src/schema/column.js'
import { odbTable } from '../../src/schema/table.js'

describe('odbTable', () => {
  it('preserves the table name when a returned column uses a reserved property name', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull(),
      name: t.string('name', 100).notNull(),
    }))

    expect(users.name).toBe('APP_USERS')
    expect(users.toNode().columns.some((column) => column.name === 'name')).toBe(true)
  })

  it('registers returned columns in the generated table schema', () => {
    const table = odbTable('APP_TABLE', (t) => {
      const columns = {
        created: t.timestamp('created').defaultCurrentTimestamp().notNull(),
        name: t.string('name', 200).notNull(),
      }

      t.unique('uq_app_table_name', ['name'])
      return columns
    })

    expect(table.toNode().columns.map((column) => column.name)).toEqual(['created', 'name'])
    expect(table.toSQLUp()).toContain('name VARCHAR2(200 CHAR) NOT NULL')
    expect(table.toSQLUp()).toContain('CREATE UNIQUE INDEX uq_app_table_name')
  })

  it('infers column value types from the schema', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull(),
      username: t.string('username', 100).notNull(),
    }))

    expectTypeOf(users.id).toEqualTypeOf<Column<number, 'id'>>()
    expectTypeOf(users.username).toEqualTypeOf<Column<string, 'username'>>()
  })
})
