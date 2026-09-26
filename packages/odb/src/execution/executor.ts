import { normalizeExecutable, prepareStatement, type Executable } from './sql.js'

export type OracleExecuteResult<T = unknown> = {
  rows?: T[]
  outBinds?: unknown
  rowsAffected?: number
}

export interface OracleConnectionLike {
  execute(sql: string, binds?: Record<string, unknown>): Promise<OracleExecuteResult>
  executeMany?(sql: string, binds: Record<string, unknown>[]): Promise<OracleExecuteResult>
  commit(): Promise<void>
  rollback(): Promise<void>
  close(): Promise<void>
}

export type ExecuteResult<T = unknown> = {
  rows?: T[]
  outBinds?: unknown
  rowsAffected?: number
}

/** A thin execution layer over a node-oracledb connection. */
export class OdbExecutor {
  constructor(private readonly connection: OracleConnectionLike) {}

  async run<T = unknown>(
    sql: string,
    bindings: Record<string, unknown> = {},
  ): Promise<ExecuteResult<T>> {
    const result = await this.connection.execute(prepareStatement(sql), bindings)
    return {
      rows: result.rows as T[] | undefined,
      outBinds: result.outBinds,
      rowsAffected: result.rowsAffected,
    }
  }

  async execute<T = unknown>(executable: Executable): Promise<ExecuteResult<T>> {
    const { sql, bindings } = normalizeExecutable(executable)
    return this.run<T>(sql, bindings)
  }

  async executeMany(
    executable: string | { sql: string },
    binds: Record<string, unknown>[],
  ): Promise<ExecuteResult> {
    if (!this.connection.executeMany) {
      throw new Error('The underlying connection does not support executeMany')
    }
    const sql = typeof executable === 'string' ? executable : executable.sql
    const result = await this.connection.executeMany(prepareStatement(sql), binds)
    return { outBinds: result.outBinds, rowsAffected: result.rowsAffected }
  }

  async transaction<T>(fn: (tx: OdbExecutor) => Promise<T>): Promise<T> {
    try {
      const result = await fn(this)
      await this.connection.commit()
      return result
    } catch (error) {
      await this.connection.rollback()
      throw error
    }
  }

  commit(): Promise<void> {
    return this.connection.commit()
  }

  rollback(): Promise<void> {
    return this.connection.rollback()
  }
}
