import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { implodeSchema, type SchemaImplodeExecutor } from '../../src/execution/schema-implode.js'

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
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

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
    const phases: string[] = []
    const result = implodeSchema(executor, 'APP', { onPhase: (phase) => phases.push(phase) })

    await vi.advanceTimersByTimeAsync(999)
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(1)
    expect(phases).toEqual(['ords', 'lock', 'drain', 'drop', 'wait'])

    await vi.advanceTimersByTimeAsync(1)
    await expect(result).resolves.toMatchObject({ dropAttempts: 2 })
    expect(phases).toEqual(['ords', 'lock', 'drain', 'drop', 'wait', 'drain', 'drop', 'verify'])
  })

  it('backs off with a five-second cap while Oracle cleans up sessions', async () => {
    const executor = new FakeExecutor(
      [true, false],
      Array.from({ length: 9 }, () => ({ errorNum: 1940 })),
    )
    const start = Date.now()
    const result = implodeSchema(executor, 'APP')

    await vi.runAllTimersAsync()

    await expect(result).resolves.toMatchObject({ dropAttempts: 10 })
    expect(Date.now() - start).toBe(37_000)
    expect(executor.calls.filter((call) => call.sql.includes('FROM gv$session'))).toHaveLength(10)
  })

  it('reports exhausted retries with the original Oracle error as the cause', async () => {
    const error = Object.assign(new Error('ORA-01940'), { errorNum: 1940 })
    const executor = new FakeExecutor([true], [error, error, error])
    const result = expect(
      implodeSchema(executor, 'APP', { maxDropAttempts: 3 }),
    ).rejects.toMatchObject({
      message: expect.stringContaining('after 3 attempts'),
      cause: error,
    })
    const start = Date.now()

    await vi.runAllTimersAsync()
    await result

    expect(Date.now() - start).toBe(3_000)
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(3)
    expect(executor.calls.filter((call) => call.sql.startsWith('SELECT username'))).toHaveLength(1)
  })

  it('does not wait when only one drop attempt is allowed', async () => {
    const executor = new FakeExecutor([true], [{ errorNum: 1940 }])
    await expect(implodeSchema(executor, 'APP', { maxDropAttempts: 1 })).rejects.toThrow(
      'after 1 attempts',
    )
    expect(vi.getTimerCount()).toBe(0)
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(1)
  })

  it('does not retry unrelated drop or session-termination errors', async () => {
    const dropError = Object.assign(new Error('ORA-01031'), { errorNum: 1031 })
    const executor = new FakeExecutor([true], [dropError])
    await expect(implodeSchema(executor, 'APP')).rejects.toBe(dropError)
    expect(executor.calls.filter((call) => call.sql.startsWith('DROP USER'))).toHaveLength(1)

    const drainError = Object.assign(new Error('ORA-00942'), { errorNum: 942 })
    const drainExecutor = new FakeExecutor([true], [], [drainError])
    await expect(implodeSchema(drainExecutor, 'APP')).rejects.toBe(drainError)
    expect(drainExecutor.calls.some((call) => call.sql.startsWith('DROP USER'))).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('allows dropping an idle schema when session termination is denied', async () => {
    const executor = new FakeExecutor([true, false], [], [{ errorNum: 1031 }])
    await expect(implodeSchema(executor, 'APP')).resolves.toMatchObject({ dropAttempts: 1 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reports active sessions when session termination is denied', async () => {
    await expect(
      implodeSchema(new FakeExecutor([true], [{ errorNum: 1940 }], [{ errorNum: 1031 }]), 'APP'),
    ).rejects.toThrow('Stop all application and ORDS connections using APP')
    expect(vi.getTimerCount()).toBe(0)
  })
})
