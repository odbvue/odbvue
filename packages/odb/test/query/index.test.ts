import { describe, expect, expectTypeOf, it } from 'vitest'
import { type SelectQuery, odbQuery } from '../../src/query/index.js'
import { type Column } from '../../src/schema/column.js'
import {
  type Insertable,
  type Selectable,
  type Updateable,
  odbTable,
} from '../../src/schema/table.js'

describe('odbQuery', () => {
  it('supports typed table schemas and column references', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull(),
      username: t.string('username', 100).notNull(),
      email: t.string('email'),
    }))

    const query = odbQuery()
      .selectFrom(users)
      .select([users.id, users.username])
      .where(users.id, '=', 42)

    expect(query.toSQL()).toBe('SELECT id, username FROM APP_USERS WHERE id = 42')
    const compiled = query.compile()
    expect(compiled.sql).toBe('SELECT id, username FROM APP_USERS WHERE id = :w0')
    expect(compiled.bindings).toEqual({ w0: 42 })
  })

  it('rejects mismatched where values at compile time', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull(),
      username: t.string('username', 100).notNull(),
    }))

    const query = odbQuery().selectFrom(users).where(users.id, '=', 7)
    expect(query.compile().sql).toContain('WHERE id = :w0')

    // @ts-expect-error number columns require number values
    odbQuery().selectFrom(users).where(users.id, '=', 'bad')
  })

  it('infers select row shapes and typed insert/update payloads', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').notNull().default('0'),
      username: t.string('username', 100).notNull(),
      email: t.string('email'),
    }))

    const selectQuery = odbQuery().selectFrom(users).select([users.id, users.username])
    const orderedQuery = odbQuery().selectFrom(users).orderBy(users.username)

    expect(selectQuery.toSQL()).toBe('SELECT id, username FROM APP_USERS')
    expect(orderedQuery.toSQL()).toBe('SELECT * FROM APP_USERS ORDER BY username ASC')

    expectTypeOf<Selectable<typeof users>>().toEqualTypeOf<{
      id: number
      username: string
      email: string | null
    }>()

    expectTypeOf(selectQuery).toExtend<
      SelectQuery<{
        id: number
        username: string
      }>
    >()

    expectTypeOf<Insertable<typeof users>>().toExtend<{
      id?: number
      username: string
      email?: string | null
    }>()

    expectTypeOf<Updateable<typeof users>>().toEqualTypeOf<{
      id?: number
      username?: string
      email?: string | null
    }>()

    odbQuery().insertInto(users).values({
      username: 'Ada',
      email: 'ada@example.com',
    })

    odbQuery().insertInto(users).values({
      username: 'Ada',
    })

    odbQuery().insertInto(users).values({
      // @ts-expect-error invalid insert value types are rejected
      id: 'bad',
      username: 'Ada',
      nope: true,
    })

    // @ts-expect-error invalid update value types are rejected
    odbQuery().updateTable(users).set({ username: 42 })
  })

  it('tracks generated and primary-key column metadata', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('id').primaryKey().generated(),
      email: t.string('email'),
    }))

    expectTypeOf(users.id).toEqualTypeOf<Column<number, 'id', false, false, true, true, 'number'>>()
    expectTypeOf<Insertable<typeof users>>().toExtend<{
      email?: string | null
    }>()

    odbQuery().insertInto(users).values({ email: 'ada@example.com' })

    // @ts-expect-error generated columns cannot be inserted
    odbQuery().insertInto(users).values({ id: 1, email: 'ada@example.com' })

    // @ts-expect-error generated columns cannot be updated
    odbQuery().updateTable(users).set({ id: 1 })
  })

  it('maps TypeScript property names to Oracle columns for writes', () => {
    const users = odbTable('APP_USERS', (t) => ({
      userId: t.number('USER_ID').notNull(),
      email: t.string('EMAIL_ADDRESS'),
    }))

    const insert = odbQuery().insertInto(users).values({ userId: 123 })
    expect(insert.compile()).toEqual({
      sql: 'INSERT INTO APP_USERS (USER_ID) VALUES (:userId)',
      bindings: { userId: 123 },
    })
    expect(insert.toSQL()).toBe('INSERT INTO APP_USERS (USER_ID) VALUES (123)')

    const update = odbQuery().updateTable(users).set({ email: 'x@y.com' })
    expect(update.compile()).toEqual({
      sql: 'UPDATE APP_USERS SET EMAIL_ADDRESS = :s_email',
      bindings: { s_email: 'x@y.com' },
    })
    expect(update.toSQL()).toBe("UPDATE APP_USERS SET EMAIL_ADDRESS = 'x@y.com'")
  })

  it('accumulates result types across chained select calls', () => {
    const users = odbTable('APP_USERS', (t) => ({
      id: t.number('ID').notNull(),
      username: t.string('USERNAME').notNull(),
      email: t.string('EMAIL'),
    }))

    const query = odbQuery().selectFrom(users).select(users.id).select(users.username)

    expect(query.toSQL()).toBe('SELECT ID, USERNAME FROM APP_USERS')
    expectTypeOf(query).toExtend<
      SelectQuery<{
        id: number
        username: string
      }>
    >()
  })

  it('rejects columns from tables outside the query scope', () => {
    const users = odbTable('APP_USERS', (t) => ({ id: t.number('USER_ID').notNull() }))
    const orders = odbTable('APP_ORDERS', (t) => ({
      orderDate: t.timestamp('ORDER_DATE').notNull(),
    }))

    // @ts-expect-error selected columns must belong to the FROM table
    odbQuery().selectFrom(users).select(orders.orderDate)
    // @ts-expect-error predicate columns must belong to the queried table
    odbQuery().selectFrom(users).where(orders.orderDate, '>', new Date())
    // @ts-expect-error ordering columns must belong to the queried table
    odbQuery().selectFrom(users).orderBy(orders.orderDate)
    // @ts-expect-error update predicates use columns from the updated table
    odbQuery().updateTable(users).where(orders.orderDate, '>', new Date())
    // @ts-expect-error delete predicates use columns from the deleted table
    odbQuery().deleteFrom(users).where(orders.orderDate, '>', new Date())
  })

  it('restricts convenience defaults to compatible column types', () => {
    const table = odbTable('DEFAULTS', (t) => ({
      id: t.guid('ID').defaultSysGuid(),
      created: t.timestamp('CREATED').defaultCurrentTimestamp(),
    }))

    expect(table.toSQLUp()).toContain('ID RAW(16) DEFAULT SYS_GUID() NOT NULL')
    expect(table.toSQLUp()).toContain('CREATED TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP')

    odbTable('INVALID_DEFAULTS', (t) => ({
      // @ts-expect-error SYS_GUID is only valid for GUID columns
      id: t.number('ID').defaultSysGuid(),
      // @ts-expect-error CURRENT_TIMESTAMP is only valid for date/timestamp columns
      flag: t.boolean('FLAG').defaultCurrentTimestamp(),
    }))
  })
})
