import fs from 'fs'

import oracledb from 'oracledb'

import { OdbExecutor, type OracleConnectionLike } from './executor.js'

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT

export type OracleConnectionConfig = oracledb.ConnectionAttributes

export function connect(config: OracleConnectionConfig): Promise<oracledb.Connection> {
  return oracledb.getConnection(config)
}

export function createExecutor(connection: oracledb.Connection): OdbExecutor {
  return new OdbExecutor(connection as unknown as OracleConnectionLike)
}

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

export function resolveTnsAlias(
  tnsPath: string,
  preferredEndsWith: string[] = ['_medium'],
): string {
  const tnsContent = fs.readFileSync(tnsPath, 'utf-8')
  const aliases: string[] = []
  for (const match of tnsContent.matchAll(/^\s*(\w+)\s*=/gm)) {
    aliases.push(match[1])
  }
  return (
    aliases.find((alias) => preferredEndsWith.some((suffix) => alias.endsWith(suffix))) ??
    aliases[0]
  )
}

export async function enableDbmsOutput(connection: oracledb.Connection): Promise<void> {
  await connection.execute(`BEGIN DBMS_OUTPUT.ENABLE(1000000); END;`)
}

export async function readDbmsOutput(connection: oracledb.Connection): Promise<string[]> {
  const lines: string[] = []
  for (;;) {
    const result = await connection.execute(`BEGIN DBMS_OUTPUT.GET_LINE(:line, :status); END;`, {
      line: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 32767 },
      status: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    })
    const outBinds = result.outBinds as { line?: string | null; status?: number }
    if ((outBinds.status ?? 1) !== 0) break
    lines.push(outBinds.line ?? '')
  }
  return lines
}
