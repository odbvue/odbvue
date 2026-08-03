import fs from 'fs'

import oracledb from 'oracledb'

import { OdbExecutor, type OracleConnectionLike } from './executor.js'

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

export type OracleConnectionConfig = oracledb.ConnectionAttributes

/** Open a node-oracledb connection using the given attributes. */
export function connect(config: OracleConnectionConfig): Promise<oracledb.Connection> {
  return oracledb.getConnection(config)
}

/** Wrap a connection in an {@link OdbExecutor}. */
export function createExecutor(connection: oracledb.Connection): OdbExecutor {
  return new OdbExecutor(connection as unknown as OracleConnectionLike)
}

/**
 * Open a connection, pass it (and an executor) to `fn`, and always close it.
 */
export async function withConnection<T>(
  config: OracleConnectionConfig,
  fn: (connection: oracledb.Connection, executor: OdbExecutor) => Promise<T>,
): Promise<T> {
  const connection = await connect(config)
  try {
    return await fn(connection, createExecutor(connection))
  } finally {
    await connection.close()
  }
}

/**
 * Resolve a TNS alias from a `tnsnames.ora` file, preferring an alias whose name
 * ends with one of `preferredEndsWith` (defaults to `_medium`).
 */
export function resolveTnsAlias(
  tnsPath: string,
  preferredEndsWith: string[] = ['_medium'],
): string {
  const tnsContent = fs.readFileSync(tnsPath, 'utf-8')
  const aliases: string[] = []
  for (const match of tnsContent.matchAll(/^\s*(\w+)\s*=/gm)) {
    aliases.push(match[1])
  }
  return aliases.find((a) => preferredEndsWith.some((suffix) => a.endsWith(suffix))) ?? aliases[0]
}

/** Enable server-side `DBMS_OUTPUT` buffering on the connection. */
export async function enableDbmsOutput(connection: oracledb.Connection): Promise<void> {
  await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`)
}

/** Drain buffered `DBMS_OUTPUT` lines from the connection. */
export async function readDbmsOutput(connection: oracledb.Connection): Promise<string[]> {
  const lines: string[] = []

  for (;;) {
    const result = await connection.execute(`BEGIN DBMS_OUTPUT.GET_LINE(:line, :status); END;`, {
      line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
      status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    })

    const outBinds = result.outBinds as { line?: string | null; status?: number }
    const status = outBinds.status ?? 1
    if (status !== 0) break

    lines.push(outBinds.line ?? '')
  }

  return lines
}
