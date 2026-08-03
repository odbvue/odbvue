import { describe, expect, it, vi } from 'vitest'
import {
  OdbExecutor,
  type OracleConnectionLike,
  type OracleExecuteResult,
} from '../src/executor.js'

type Call = { sql: string; binds?: Record<string, unknown> }

function fakeConnection(result: OracleExecuteResult = {}): {
  connection: OracleConnectionLike
  calls: Call[]
  commit: ReturnType<typeof vi.fn>
  rollback: ReturnType<typeof vi.fn>
} {
  const calls: Call[] = []
  const commit = vi.fn<() => Promise<void>>(async () => {})
  const rollback = vi.fn<() => Promise<void>>(async () => {})
  const connection: OracleConnectionLike = {
    execute: async (sql, binds) => {
      calls.push({ sql, binds })
      return result
    },
    commit,
    rollback,
    close: async () => {},
  }
  return { connection, calls, commit, rollback }
}

describe('OdbExecutor.execute', () => {
  it('strips the trailing semicolon from plain SQL and forwards bindings', async () => {
    const { connection, calls } = fakeConnection({ rows: [{ n: 1 }] })
    const executor = new OdbExecutor(connection)

    const result = await executor.execute({ sql: 'SELECT :n FROM dual;', bindings: { n: 1 } })

    expect(calls[0]).toEqual({ sql: 'SELECT :n FROM dual', binds: { n: 1 } })
    expect(result.rows).toEqual([{ n: 1 }])
  })

  it('keeps the trailing semicolon for PL/SQL blocks', async () => {
    const { connection, calls } = fakeConnection()
    const executor = new OdbExecutor(connection)

    await executor.execute('BEGIN NULL; END;')

    expect(calls[0].sql).toBe('BEGIN NULL; END;')
  })

  it('compiles a query builder before executing', async () => {
    const { connection, calls } = fakeConnection()
    const executor = new OdbExecutor(connection)
    const builder = {
      compile: () => ({ sql: 'DELETE FROM t WHERE id = :id', bindings: { id: 7 } }),
    }

    await executor.execute(builder)

    expect(calls[0]).toEqual({ sql: 'DELETE FROM t WHERE id = :id', binds: { id: 7 } })
  })
})

describe('OdbExecutor.transaction', () => {
  it('commits when the callback resolves', async () => {
    const { connection, commit, rollback } = fakeConnection()
    const executor = new OdbExecutor(connection)

    const result = await executor.transaction(async (tx) => {
      await tx.run('INSERT INTO t VALUES (1)')
      return 'ok'
    })

    expect(result).toBe('ok')
    expect(commit).toHaveBeenCalledOnce()
    expect(rollback).not.toHaveBeenCalled()
  })

  it('rolls back and rethrows when the callback fails', async () => {
    const { connection, commit, rollback } = fakeConnection()
    const executor = new OdbExecutor(connection)

    await expect(
      executor.transaction(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')

    expect(commit).not.toHaveBeenCalled()
    expect(rollback).toHaveBeenCalledOnce()
  })
})

describe('OdbExecutor.executeMany', () => {
  it('throws when the connection lacks executeMany', async () => {
    const { connection } = fakeConnection()
    const executor = new OdbExecutor(connection)

    await expect(executor.executeMany('INSERT INTO t VALUES (:v)', [{ v: 1 }])).rejects.toThrow(
      'does not support executeMany',
    )
  })
})
