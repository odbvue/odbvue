import { describe, expect, it } from 'vitest'

import {
  implodeSchema,
  type SchemaImplodeExecutor,
} from '../src/oracle/execution/schema-implode.js'

class FakeExecutor implements SchemaImplodeExecutor {
  readonly calls: Array<{ sql: string; bindings?: Record<string, unknown> }> = []
  commits = 0

  constructor(
    private readonly existence: boolean[],
    private readonly dropErrors: unknown[] = [],
    private readonly drainErrors: unknown[] = [],
  ) {}

  async run<T = unknown>(sql: string, bindings?: Record<string, unknown>) {
    this.calls.push({ sql, bindings })
    if (sql.startsWith('SELECT username')) {
      return { rows: (this.existence.shift() ? [{ USERNAME: 'APP' }] : []) as T[] }
    }
    if (sql.startsWith('DROP USER') && this.dropErrors.length) throw this.dropErrors.shift()
    if (sql.includes('FROM gv$session') && this.drainErrors.length) throw this.drainErrors.shift()
    return {}
  }

  async commit(): Promise<void> {
    this.commits++
  }
}

describe('implodeSchema', () => {
  it('removes ORDS metadata before locking, draining, and dropping the user', async () => {
    const executor = new FakeExecutor([true, false])
    await expect(implodeSchema(executor, 'app')).resolves.toEqual({
      schema: 'APP',
      userExisted: true,
      dropAttempts: 1,
    })
    expect(
      executor.calls.findIndex((call) => call.sql.includes('ORDS.DROP_REST_FOR_SCHEMA')),
    ).toBeLessThan(executor.calls.findIndex((call) => call.sql.startsWith('ALTER USER')))
    expect(executor.commits).toBe(1)
  })

  it('succeeds when the user is absent and rejects unsafe schema identifiers', async () => {
    await expect(implodeSchema(new FakeExecutor([false]), 'APP')).resolves.toMatchObject({
      userExisted: false,
    })
    await expect(implodeSchema(new FakeExecutor([]), 'APP; DROP USER ADMIN')).rejects.toThrow(
      'Invalid Oracle schema name',
    )
  })

  it('retries ORA-01940 after draining sessions', async () => {
    const executor = new FakeExecutor([true, false], [{ errorNum: 1940 }])
    await expect(implodeSchema(executor, 'APP')).resolves.toMatchObject({ dropAttempts: 2 })
  })

  it('reports active sessions when session termination is denied', async () => {
    await expect(
      implodeSchema(new FakeExecutor([true], [{ errorNum: 1940 }], [{ errorNum: 1031 }]), 'APP'),
    ).rejects.toThrow('Stop all application and ORDS connections using APP')
  })
})
