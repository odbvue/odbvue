import { describe, expect, it, vi } from 'vitest'

import {
  OdbExecutor,
  type OracleConnectionLike,
  type OracleExecuteResult,
} from '../src/oracle/execution/executor.js'

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

describe('OdbExecutor', () => {
  it('normalizes SQL and forwards bindings', async () => {
    const { connection, calls } = fakeConnection({ rows: [{ n: 1 }] })
    const result = await new OdbExecutor(connection).execute({
      sql: 'SELECT :n FROM dual;',
      bindings: { n: 1 },
    })
    expect(calls[0]).toEqual({ sql: 'SELECT :n FROM dual', binds: { n: 1 } })
    expect(result.rows).toEqual([{ n: 1 }])
  })

  it('keeps PL/SQL terminators and runs query builders', async () => {
    const { connection, calls } = fakeConnection()
    const executor = new OdbExecutor(connection)
    await executor.execute('BEGIN NULL; END;')
    await executor.execute({ compile: () => ({ sql: 'DELETE FROM t', bindings: {} }) })
    expect(calls.map((call) => call.sql)).toEqual(['BEGIN NULL; END;', 'DELETE FROM t'])
  })

  it('commits successful transactions and rolls back failures', async () => {
    const successful = fakeConnection()
    await new OdbExecutor(successful.connection).transaction(async () => 'ok')
    expect(successful.commit).toHaveBeenCalledOnce()

    const failed = fakeConnection()
    await expect(
      new OdbExecutor(failed.connection).transaction(async () => {
        throw new Error('boom')
      }),
    ).rejects.toThrow('boom')
    expect(failed.rollback).toHaveBeenCalledOnce()
  })

  it('rejects batches when the connection does not implement executeMany', async () => {
    await expect(
      new OdbExecutor(fakeConnection().connection).executeMany('INSERT INTO t VALUES (:v)', [
        { v: 1 },
      ]),
    ).rejects.toThrow('does not support executeMany')
  })
})
