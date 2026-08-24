import prompts from 'prompts'

import { implodeSchema, withConnection, type SchemaImplodePhase } from '@odbvue/odb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { logger } from '../shared/logger.js'

import { buildConnectionConfig } from './db-exec.js'
import { writeEmptyDeployedOpenApi } from './db-openapi.js'

export type DbImplodeOptions = {
  schema?: string
  yes?: boolean
}

const phaseMessages: Record<SchemaImplodePhase, string> = {
  ords: 'Removing ORDS metadata...',
  lock: 'Locking the schema account...',
  drain: 'Disconnecting schema sessions...',
  drop: 'Dropping the schema...',
  verify: 'Verifying schema removal...',
}

export const runDbImplode = async (options: DbImplodeOptions = {}): Promise<boolean> => {
  const configuredSchema = new SecretsStore().get('ODBVUE_ADB_SCHEMA_USERNAME')?.toUpperCase()
  if (!configuredSchema) throw new Error('Schema username not found in secrets')

  const schema = options.schema?.toUpperCase() ?? configuredSchema
  if (schema !== configuredSchema) {
    throw new Error(`Schema ${schema} does not match configured schema ${configuredSchema}`)
  }

  if (!options.yes) {
    logger.warn(`This permanently removes schema ${schema} and all of its data.`)
    const { confirmation } = await prompts({
      type: 'text',
      name: 'confirmation',
      message: `Type ${schema} to confirm database implode`,
    })
    if (confirmation !== schema) {
      logger.info('Database implode cancelled.')
      return false
    }
  }

  const config = buildConnectionConfig(false)
  const result = await withConnection(config, async (_connection, executor) =>
    implodeSchema(executor, schema, {
      onPhase: (phase) => logger.info(phaseMessages[phase]),
    }),
  )

  if (result.userExisted) {
    logger.success(`Schema ${schema} and its ORDS metadata were removed.`)
  } else {
    logger.success(`ORDS metadata removed; schema ${schema} was already absent.`)
  }
  await writeEmptyDeployedOpenApi()
  logger.lf()
  return true
}
