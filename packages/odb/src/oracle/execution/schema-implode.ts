import type { ExecuteResult } from './executor.js'

export type SchemaImplodePhase = 'ords' | 'lock' | 'drain' | 'drop' | 'verify'

export interface SchemaImplodeExecutor {
  run<T = unknown>(sql: string, bindings?: Record<string, unknown>): Promise<ExecuteResult<T>>
  commit(): Promise<void>
}

export type SchemaImplodeOptions = {
  maxDropAttempts?: number
  onPhase?: (phase: SchemaImplodePhase) => void
}

export type SchemaImplodeResult = {
  schema: string
  userExisted: boolean
  dropAttempts: number
}

const normalizeSchema = (schema: string): string => {
  const normalized = schema.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9_$#]{0,127}$/.test(normalized)) {
    throw new Error(`Invalid Oracle schema name "${schema}"`)
  }
  return normalized
}

const errorNumber = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object' || !('errorNum' in error)) return undefined
  const value = (error as { errorNum?: unknown }).errorNum
  return typeof value === 'number' ? value : undefined
}

const userExists = async (executor: SchemaImplodeExecutor, schema: string): Promise<boolean> => {
  const result = await executor.run('SELECT username FROM all_users WHERE username = :schema', {
    schema,
  })
  return (result.rows?.length ?? 0) > 0
}

const removeOrdsMetadata = async (
  executor: SchemaImplodeExecutor,
  schema: string,
  disableSchema: boolean,
): Promise<void> => {
  const disableSql = disableSchema
    ? '  ORDS.ENABLE_SCHEMA(p_enabled => FALSE, p_schema => :schema);\n  COMMIT;\n'
    : ''
  await executor.run(
    `BEGIN
${disableSql}  ORDS.DROP_REST_FOR_SCHEMA(p_schema => :schema);
  COMMIT;
END;`,
    { schema: schema.toLowerCase() },
  )
  await executor.commit()
}

const drainSessions = async (executor: SchemaImplodeExecutor, schema: string): Promise<boolean> => {
  try {
    await executor.run(
      `BEGIN
  FOR session_row IN (
    SELECT inst_id, sid, serial#
    FROM gv$session
    WHERE username = :schema
  ) LOOP
    BEGIN
      EXECUTE IMMEDIATE
        'ALTER SYSTEM KILL SESSION ''' || session_row.sid || ',' || session_row.serial# || ',@' || session_row.inst_id || ''' IMMEDIATE';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLCODE NOT IN (-30, -31) THEN
          RAISE;
        END IF;
    END;
  END LOOP;
END;`,
      { schema },
    )
    return true
  } catch (error) {
    if (errorNumber(error) !== 1031) throw error
    return false
  }
}

export const implodeSchema = async (
  executor: SchemaImplodeExecutor,
  schema: string,
  options: SchemaImplodeOptions = {},
): Promise<SchemaImplodeResult> => {
  const normalizedSchema = normalizeSchema(schema)
  const maxDropAttempts = options.maxDropAttempts ?? 5
  if (!Number.isInteger(maxDropAttempts) || maxDropAttempts < 1) {
    throw new Error('maxDropAttempts must be a positive integer')
  }

  const existed = await userExists(executor, normalizedSchema)
  options.onPhase?.('ords')
  await removeOrdsMetadata(executor, normalizedSchema, existed)
  if (!existed) return { schema: normalizedSchema, userExisted: false, dropAttempts: 0 }

  options.onPhase?.('lock')
  await executor.run(`ALTER USER ${normalizedSchema} ACCOUNT LOCK`)

  let dropAttempts = 0
  for (; dropAttempts < maxDropAttempts; dropAttempts++) {
    options.onPhase?.('drain')
    const sessionsDrained = await drainSessions(executor, normalizedSchema)
    options.onPhase?.('drop')
    try {
      await executor.run(`DROP USER ${normalizedSchema} CASCADE`)
      dropAttempts++
      break
    } catch (error) {
      if (errorNumber(error) === 1940 && !sessionsDrained) {
        throw new Error(
          `Cannot drop schema ${normalizedSchema}: it has active sessions, and this database does not permit session termination. Stop all application and ORDS connections using ${normalizedSchema}, wait for them to close, then retry.`,
          { cause: error },
        )
      }
      if (errorNumber(error) !== 1940 || dropAttempts === maxDropAttempts - 1) throw error
    }
  }

  options.onPhase?.('verify')
  if (await userExists(executor, normalizedSchema)) {
    throw new Error(`Schema ${normalizedSchema} still exists after DROP USER`)
  }
  return { schema: normalizedSchema, userExisted: true, dropAttempts }
}
