import { describe, expect, it } from 'vitest'
import { odbExpr, compileExpression, renderExpression } from '../../src/query/ast.js'
import { odbQuery } from '../../src/query/index.js'
import { odbTable } from '../../src/schema/table.js'

const users = odbTable('APP_USERS', (t) => ({
  id: t.number('id').notNull(),
  status: t.string('status', 1).notNull(),
  createdAt: t.timestamp('created_at').notNull(),
}))

describe('expression AST', () => {
  it('compiles a binary comparison with a bind parameter', () => {
    const node = odbExpr(users.status, '=', 'A')
    const { sql, bindings } = compileExpression(node)
    expect(sql).toBe('status = :w0')
    expect(bindings).toEqual({ w0: 'A' })
  })

  it('renders a binary comparison inline', () => {
    const node = odbExpr(users.id, '>', 5)
    expect(renderExpression(node)).toBe('id > 5')
  })

  it('compiles AND / OR trees with precedence parentheses', () => {
    const node = odbExpr.or([
      odbExpr(users.status, '=', 'A'),
      odbExpr.and([odbExpr(users.status, '=', 'N'), odbExpr(users.id, '>', 10)]),
    ])
    const { sql, bindings } = compileExpression(node)
    expect(sql).toBe('status = :w0 OR (status = :w1 AND id > :w2)')
    expect(bindings).toEqual({ w0: 'A', w1: 'N', w2: 10 })
  })

  it('supports IS NULL tests without binding', () => {
    const node = odbExpr(users.createdAt, 'IS NULL')
    const { sql, bindings } = compileExpression(node)
    expect(sql).toBe('created_at IS NULL')
    expect(bindings).toEqual({})
  })

  it('supports function calls and column-to-column comparisons', () => {
    const node = odbExpr(odbExpr.fn('UPPER', users.status), '=', odbExpr.ref('target'))
    expect(renderExpression(node)).toBe('UPPER(status) = target')
  })

  it('supports NOT and raw SQL nodes', () => {
    const node = odbExpr.not(odbExpr.raw('id = 1'))
    expect(renderExpression(node)).toBe('NOT (id = 1)')
  })

  it('compiles a subquery, re-keying nested bind parameters', () => {
    const sub = odbQuery().selectFrom(users).select(users.id).where(users.status, '=', 'A')
    const node = odbExpr(users.id, '=', odbExpr.subquery(sub))
    const { sql, bindings } = compileExpression(node)
    expect(sql).toBe('id = (SELECT id FROM APP_USERS WHERE status = :w0)')
    expect(bindings).toEqual({ w0: 'A' })
  })
})

describe('query builder with expression callbacks', () => {
  it('accepts an expression-builder callback in where()', () => {
    const query = odbQuery()
      .selectFrom(users)
      .select(users.id)
      .where((eb) => eb.or([eb(users.status, '=', 'A'), eb(users.status, '=', 'N')]))

    const { sql, bindings } = query.compile()
    expect(sql).toBe('SELECT id FROM APP_USERS WHERE status = :w0 OR status = :w1')
    expect(bindings).toEqual({ w0: 'A', w1: 'N' })
  })

  it('combines multiple where() calls with AND', () => {
    const query = odbQuery()
      .selectFrom(users)
      .select(users.id)
      .where(users.status, '=', 'A')
      .where(users.id, '>', 10)

    const { sql, bindings } = query.compile()
    expect(sql).toBe('SELECT id FROM APP_USERS WHERE status = :w0 AND id > :w1')
    expect(bindings).toEqual({ w0: 'A', w1: 10 })
  })
})
