import { normalizeExecutable, prepareStatement, type Executable } from './sql.js'

/** The subset of a node-oracledb result the executor relies on. */
export type OracleExecuteResult<T = unknown> = {
  rows?: T[]
  outBinds?: unknown
  rowsAffected?: number
}

/**
 * The subset of a node-oracledb `Connection` the executor relies on. A real
 * `oracledb.Connection` satisfies this structurally; tests can supply a fake.
 */
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

/**
 * A thin execution layer over a node-oracledb connection. Accepts raw SQL,
 * compiled queries, or query builders, and normalizes PL/SQL vs SQL statement
 * termination before running them.
 */
export class OdbExecutor {
  constructor(private readonly connection: OracleConnectionLike) {}

  /** Execute a raw SQL string with optional bind parameters. */
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

  /** Execute an executable: raw SQL, a compiled query, or a query builder. */
  async execute<T = unknown>(executable: Executable): Promise<ExecuteResult<T>> {
    const { sql, bindings } = normalizeExecutable(executable)
    return this.run<T>(sql, bindings)
  }

  /** Execute a statement once per row of bind parameters (batch). */
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

  /**
   * Run `fn` inside a transaction, committing on success and rolling back on
   * error. The same executor is passed to `fn` so statements share the connection.
   */
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

  /** Commit the current transaction. */
  commit(): Promise<void> {
    return this.connection.commit()
  }

  /** Roll back the current transaction. */
  rollback(): Promise<void> {
    return this.connection.rollback()
  }
}
