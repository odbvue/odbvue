import { describe, expect, it } from 'vitest'

import {
  implodeSchema,
  type SchemaImplodeExecutor,
  type SchemaImplodePhase,
} from '../src/schema-implode.js'

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
      const exists = this.existence.shift() ?? false
      return { rows: (exists ? [{ USERNAME: 'APP' }] : []) as T[] }
    }

    if (sql.startsWith('DROP USER') && this.dropErrors.length > 0) {
      throw this.dropErrors.shift()
    }

    if (sql.includes('FROM gv$session') && this.drainErrors.length > 0) {
      throw this.drainErrors.shift()
    }

    return {}
  }

  async commit(): Promise<void> {
    this.commits++
  }
}

describe('implodeSchema', () => {
  it('removes ORDS metadata before locking, draining, and dropping the user', async () => {
    const executor = new FakeExecutor([true, false])
    const phases: SchemaImplodePhase[] = []

    const result = await implodeSchema(executor, 'app', {
      onPhase: (phase) => phases.push(phase),
    })

    expect(result).toEqual({ schema: 'APP', userExisted: true, dropAttempts: 1 })
    expect(phases).toEqual(['ords', 'lock', 'drain', 'drop', 'verify'])
    const ordsIndex = executor.calls.findIndex((call) =>
      call.sql.includes('ORDS.DROP_REST_FOR_SCHEMA'),
    )
    expect(ordsIndex).toBeLessThan(
      executor.calls.findIndex((call) => call.sql.startsWith('ALTER USER')),
    )
    expect(executor.calls.findIndex((call) => call.sql.startsWith('ALTER USER'))).toBeLessThan(
      executor.calls.findIndex((call) => call.sql.startsWith('DROP USER')),
    )
    expect(executor.commits).toBe(1)
  })

  it('is successful when the user is already absent', async () => {
    const executor = new FakeExecutor([false])

    await expect(implodeSchema(executor, 'APP')).resolves.toEqual({
      schema: 'APP',
      userExisted: false,
      dropAttempts: 0,
    })
    expect(executor.calls.some((call) => call.sql.startsWith('ALTER USER'))).toBe(false)
    const ordsCall = executor.calls.find((call) => call.sql.includes('ORDS.DROP_REST_FOR_SCHEMA'))
    expect(ordsCall?.sql).not.toContain('ORDS.ENABLE_SCHEMA')
  })

  it('drains again and retries ORA-01940', async () => {
    const executor = new FakeExecutor([true, false], [{ errorNum: 1940 }])

    const result = await implodeSchema(executor, 'APP')

    expect(result.dropAttempts).toBe(2)
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(2)
    expect(executor.calls.filter((call) => call.sql.includes('FROM gv$session'))).toHaveLength(2)
  })

  it('continues when session draining lacks ALTER SYSTEM privileges', async () => {
    const executor = new FakeExecutor([true, false], [], [{ errorNum: 1031 }])

    await expect(implodeSchema(executor, 'APP')).resolves.toEqual({
      schema: 'APP',
      userExisted: true,
      dropAttempts: 1,
    })
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(1)
  })

  it('reports active sessions when the database denies session termination', async () => {
    const executor = new FakeExecutor([true], [{ errorNum: 1940 }], [{ errorNum: 1031 }])

    await expect(implodeSchema(executor, 'APP')).rejects.toThrow(
      'Stop all application and ORDS connections using APP',
    )
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(1)
  })

  it('does not retry unrelated drop errors', async () => {
    const executor = new FakeExecutor([true], [{ errorNum: 1031 }])

    await expect(implodeSchema(executor, 'APP')).rejects.toEqual({ errorNum: 1031 })
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(1)
  })

  it('rejects unsafe schema identifiers', async () => {
    const executor = new FakeExecutor([])

    await expect(implodeSchema(executor, 'APP; DROP USER ADMIN')).rejects.toThrow(
      'Invalid Oracle schema name',
    )
    expect(executor.calls).toEqual([])
  })
})
