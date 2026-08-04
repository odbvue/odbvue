import { describe, expect, expectTypeOf, it } from 'vitest'
import { odbQuery } from '../../src/query/index.js'
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
      id: t.number('id').notNull().defaultSysGuid(),
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

    expectTypeOf<Insertable<typeof users>>().toEqualTypeOf<{
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

    // @ts-expect-error invalid insert value types are rejected
    odbQuery().insertInto(users).values({
      id: 'bad',
      username: 'Ada',
      nope: true,
    })

    // @ts-expect-error invalid update value types are rejected
    odbQuery().updateTable(users).set({ username: 42 })
  })
})
