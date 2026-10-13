import { readFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import prompts, { type PromptObject } from 'prompts'

import { authJwtSettings, odbAcl, odbLiteral, odbSettings, withConnection } from '@odbvue/odb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { logger } from '../shared/logger.js'
import { buildConnectionConfig } from './db-exec.js'

type SetupSettings = {
  host: string
  port: number
  username: string
  password: string
  from_addr: string
  from_name: string
  auth_jwt_issuer: string
  auth_jwt_expiration_seconds: number
  auth_jwt_secret?: string
}

const hostValid = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 255 &&
  /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value)
const portValid = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535
const credentialValid = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 2000
const addressValid = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 240 &&
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(value)
const nameValid = (value: unknown) =>
  typeof value === 'string' &&
  value.trim().length > 0 &&
  value.length <= 240 &&
  [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)

const validators: Record<string, (value: unknown) => boolean> = {
  host: hostValid,
  port: portValid,
  username: credentialValid,
  password: credentialValid,
  from_addr: addressValid,
  from_name: nameValid,
  auth_jwt_issuer: (value) => authJwtSettings.issuerValid(value),
  auth_jwt_expiration_seconds: (value) => authJwtSettings.expirationValid(value),
}
const fileValidators: Record<string, (value: unknown) => boolean> = {
  ...validators,
  auth_jwt_secret: credentialValid,
}

const settingsValid = (settings: Record<string, unknown>): settings is SetupSettings =>
  Object.entries(validators).every(([name, validate]) => validate(settings[name]))

export const runSetupSettings = async (file?: string): Promise<boolean> => {
  const fileSettings: Record<string, unknown> = {}
  if (file !== undefined) {
    const values: unknown = JSON.parse(await readFile(file, 'utf-8'))
    if (values === null || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('Settings file must contain a JSON object')
    }
    for (const [key, value] of Object.entries(values)) {
      const normalized = key.toLowerCase()
      const name = normalized.startsWith('smtp_') ? normalized.slice('smtp_'.length) : normalized
      if (
        (!normalized.startsWith('smtp_') && !normalized.startsWith('auth_jwt_')) ||
        !Object.hasOwn(fileValidators, name)
      ) {
        throw new Error(`Unknown setting key: ${key}`)
      }
      if (Object.hasOwn(fileSettings, name)) {
        throw new Error(`Duplicate setting key (case-insensitive): ${key}`)
      }
      if (!fileValidators[name]!(value)) {
        throw new Error(`Invalid setting: ${key}; no settings or ACLs were changed`)
      }
      if (
        name === 'auth_jwt_secret' &&
        typeof value === 'string' &&
        !authJwtSettings.secretValid(value)
      ) {
        fileSettings[name] = createHash('sha256').update(value, 'utf8').digest('hex')
      } else {
        fileSettings[name] = value
      }
    }
  }

  let cancelled = false
  const questions: PromptObject[] = [
    {
      type: 'text',
      name: 'host',
      message: 'SMTP host',
      validate: (value) => hostValid(value) || 'Enter an SMTP hostname (no URL or wildcard)',
    },
    {
      type: 'number',
      name: 'port',
      message: 'SMTP port',
      initial: 587,
      validate: (value) =>
        portValid(value === '' ? 587 : value) || 'Enter an integer port from 1 to 65535',
    },
    {
      type: 'text',
      name: 'username',
      message: 'SMTP username',
      validate: (value) =>
        credentialValid(value) || 'Enter an SMTP username (up to 2000 characters)',
    },
    {
      type: 'password',
      name: 'password',
      message: 'SMTP password',
      validate: (value) =>
        credentialValid(value) || 'Enter an SMTP password (up to 2000 characters)',
    },
    {
      type: 'text',
      name: 'from_addr',
      message: 'SMTP from address',
      initial: 'admin@odbvue.com',
      validate: (value) => addressValid(value) || 'Enter a valid sender email address',
    },
    {
      type: 'text',
      name: 'from_name',
      message: 'SMTP from name',
      initial: 'Odbvue Admin',
      validate: (value) =>
        nameValid(value) || 'Enter a sender name without control characters (up to 240 characters)',
    },
    {
      type: 'text',
      name: 'auth_jwt_issuer',
      message: 'JWT issuer',
      initial: authJwtSettings.defaultIssuer,
      validate: (value) =>
        authJwtSettings.issuerValid(value) || 'Enter 1-255 visible ASCII characters (no spaces)',
    },
    {
      type: 'number',
      name: 'auth_jwt_expiration_seconds',
      message: 'JWT expiration (seconds)',
      initial: authJwtSettings.defaultExpirationSeconds,
      validate: (value) =>
        authJwtSettings.expirationValid(
          value === '' ? authJwtSettings.defaultExpirationSeconds : value,
        ) || `Enter an integer from 1 to ${authJwtSettings.maxExpirationSeconds}`,
    },
  ]
  const missingQuestions = questions.filter(
    (question) => !Object.hasOwn(fileSettings, String(question.name)),
  )
  const answers: Record<string, unknown> = missingQuestions.length
    ? await prompts(missingQuestions, {
        onCancel: () => {
          cancelled = true
        },
      })
    : {}
  const settings = { ...fileSettings, ...answers }

  if (cancelled) {
    logger.info('Settings setup cancelled. No settings or ACLs were changed.')
    return false
  }
  if (!settingsValid(settings)) {
    throw new Error('Invalid settings; no settings or ACLs were changed')
  }

  const schema = new SecretsStore().get('ODBVUE_ADB_SCHEMA_USERNAME')?.trim().toUpperCase()
  if (!schema || !/^[A-Z][A-Z0-9_$#]{0,127}$/.test(schema)) {
    throw new Error('A valid schema username is required in ODBVUE_ADB_SCHEMA_USERNAME')
  }
  const writes = (
    [
      ['SMTP_HOST', 'host'],
      ['SMTP_PORT', 'port_value'],
      ['SMTP_USERNAME', 'username'],
      ['SMTP_PASSWORD', 'password'],
      ['SMTP_FROM_ADDR', 'from_addr'],
      ['SMTP_FROM_NAME', 'from_name'],
      ['AUTH_JWT_SECRET', 'jwt_secret'],
      ['AUTH_JWT_ISSUER', 'auth_jwt_issuer'],
      ['AUTH_JWT_EXPIRATION_SECONDS', 'jwt_expiration'],
    ] as const
  )
    .map(([id, bind]) => `  ${schema}.${odbSettings.write(odbLiteral(id), `:${bind}`).toSQL()};`)
    .join('\n')

  const sql = `BEGIN
${writes}
  ${schema}.${odbAcl.addSmtp(':host', ':port').toSQL()};
END;`

  await withConnection(buildConnectionConfig(false), async (_connection, executor) => {
    await executor.transaction(async (tx) => {
      const { auth_jwt_secret, auth_jwt_expiration_seconds, ...values } = settings
      await tx.run(sql, {
        ...values,
        port_value: String(settings.port),
        jwt_secret: auth_jwt_secret ?? randomBytes(32).toString('hex'),
        jwt_expiration: String(auth_jwt_expiration_seconds),
      })
    })
  })
  logger.success(`SMTP and JWT settings saved and host ACL updated for ${schema}.`)
  return true
}
