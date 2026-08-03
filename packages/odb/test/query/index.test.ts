import { describe, expect, it } from 'vitest'
import { odbQuery } from '../../src/query/index.js'
import { odbTable } from '../../src/schema/table.js'

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
})
