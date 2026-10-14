import { readFile } from 'node:fs/promises'
import { createHash, randomBytes } from 'node:crypto'
import prompts, { type PromptObject } from 'prompts'

import { authJwtSettings, odbAcl, odbLiteral, odbSettings, withConnection } from '@odbvue/odb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { ConfigStore } from '../adapters/config-store.js'
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
  app_public_url: string
  auth_google_enabled: boolean
  auth_google_client_id?: string
  auth_google_client_secret?: string
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

const publicUrlValid = (value: unknown): boolean => {
  if (
    typeof value !== 'string' ||
    value.length > 2000 ||
    !/^https?:\/\/[^\s<>"'&?#\\]+$/.test(value) ||
    ![...value].every(
      (character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
  )
    return false
  try {
    const url = new URL(value)
    return !!url.hostname && !url.username && !url.password
  } catch (error) {
    if (error instanceof TypeError) return false
    throw error
  }
}

const googleClientIdValid = (value: unknown) =>
  typeof value === 'string' &&
  value.length <= 255 &&
  /^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value)
const googleEnabledValid = (value: unknown) =>
  typeof value === 'boolean' || value === 'Y' || value === 'N'
const googleEnabled = (value: unknown) => value === true || value === 'Y'
const loopbackHostnames = ['localhost', '127.0.0.1', '[::1]']
const googleRedirectValid = (value: unknown) => {
  if (
    typeof value !== 'string' ||
    !publicUrlValid(value) ||
    /[*{}]|%(?:0[0-9a-f]|1[0-9a-f]|20|7f)/i.test(value)
  )
    return false
  const url = new URL(value)
  const host = value.match(/^https?:\/\/(\[[^\]]+\]|[^/:]+)(?::[0-9]+)?(?:\/|$)/)?.[1]
  if (!host || (!host.startsWith('[') && !hostValid(host))) return false
  return (
    url.protocol === 'https:' ||
    (url.protocol === 'http:' && loopbackHostnames.includes(host.toLowerCase()))
  )
}

export const deriveGoogleRedirectUri = (appPublicUrl: string, apiUrl?: string): string => {
  if (!googleRedirectValid(appPublicUrl)) {
    throw new Error('Google sign-in requires a valid HTTPS APP_PUBLIC_URL (HTTP only on loopback)')
  }
  const development = loopbackHostnames.includes(new URL(appPublicUrl).hostname)
  const baseUrl = development ? appPublicUrl : apiUrl
  if (!baseUrl) {
    throw new Error(
      'Google sign-in requires the configured runtime.apiUrl for a non-loopback APP_PUBLIC_URL',
    )
  }
  const redirectUri = `${baseUrl.replace(/\/+$/, '')}/${development ? 'api/' : ''}auth/google/callback`
  if (!googleRedirectValid(redirectUri) || (!development && !redirectUri.startsWith('https://'))) {
    throw new Error('The configured API URL must produce a valid HTTPS Google callback')
  }
  return redirectUri
}
const googleValidators: Record<string, (value: unknown) => boolean> = {
  auth_google_enabled: googleEnabledValid,
  auth_google_client_id: googleClientIdValid,
  auth_google_client_secret: credentialValid,
}

const validators: Record<string, (value: unknown) => boolean> = {
  host: hostValid,
  port: portValid,
  username: credentialValid,
  password: credentialValid,
  from_addr: addressValid,
  from_name: nameValid,
  auth_jwt_issuer: (value) => authJwtSettings.issuerValid(value),
  auth_jwt_expiration_seconds: (value) => authJwtSettings.expirationValid(value),
  app_public_url: publicUrlValid,
}
const fileValidators: Record<string, (value: unknown) => boolean> = {
  ...validators,
  auth_jwt_secret: credentialValid,
  ...googleValidators,
}

const settingsValid = (settings: Record<string, unknown>): settings is SetupSettings =>
  Object.entries(validators).every(([name, validate]) => validate(settings[name])) &&
  typeof settings.auth_google_enabled === 'boolean' &&
  (!settings.auth_google_enabled ||
    Object.entries(googleValidators).every(([name, validate]) => validate(settings[name])))

export const runSetupSettings = async (file?: string): Promise<boolean> => {
  const fileSettings: Record<string, unknown> = {}
  if (file !== undefined) {
    const values: unknown = JSON.parse(await readFile(file, 'utf-8'))
    if (values === null || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('Settings file must contain a JSON object')
    }
    for (const [key, value] of Object.entries(values)) {
      const normalized = key.toLowerCase()
      if (normalized === 'auth_google_redirect_uri') {
        throw new Error(
          'AUTH_GOOGLE_REDIRECT_URI is derived automatically; remove it from the settings file',
        )
      }
      const name = ['vite_google_client_id', 'google_client_id'].includes(normalized)
        ? 'auth_google_client_id'
        : normalized.startsWith('smtp_')
          ? normalized.slice('smtp_'.length)
          : normalized
      if (
        (!normalized.startsWith('smtp_') &&
          !normalized.startsWith('auth_jwt_') &&
          !normalized.startsWith('auth_google_') &&
          !['vite_google_client_id', 'google_client_id'].includes(normalized) &&
          normalized !== 'app_public_url') ||
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
      type: 'confirm',
      name: 'auth_google_enabled',
      message: 'Enable Google sign-in (backend authorization code flow)?',
      initial: false,
    },
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
      type: 'text',
      name: 'app_public_url',
      message: 'Public application URL (for account emails and Google sign-in)',
      initial: 'http://localhost:5173/',
      validate: (value) =>
        publicUrlValid(value) ||
        'Enter an absolute HTTP(S) URL without credentials, query strings, or fragments',
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
  const settings: Record<string, unknown> = { ...fileSettings, ...answers }
  if (Object.hasOwn(fileSettings, 'auth_google_enabled')) {
    settings.auth_google_enabled = googleEnabled(fileSettings.auth_google_enabled)
  }
  if (!cancelled && settings.auth_google_enabled === true) {
    const googleQuestions: PromptObject[] = [
      {
        type: 'text',
        name: 'auth_google_client_id',
        message: 'Google OAuth client ID',
        initial: '1072025622820-jodheg6ka328ga1rgueo0u65q856hmfo.apps.googleusercontent.com',
        validate: (value) => googleClientIdValid(value) || 'Enter a Google OAuth client ID',
      },
      {
        type: 'password',
        name: 'auth_google_client_secret',
        message: 'Google OAuth client secret',
        validate: (value) => credentialValid(value) || 'Enter a Google OAuth client secret',
      },
    ]
    const missingGoogle = googleQuestions.filter(
      (question) => !Object.hasOwn(settings, String(question.name)),
    )
    if (missingGoogle.length) {
      Object.assign(
        settings,
        await prompts(missingGoogle, {
          onCancel: () => {
            cancelled = true
          },
        }),
      )
    }
  }

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
  const settingWrites: [string, string, string?][] = [
    ['SMTP_HOST', 'host'],
    ['SMTP_PORT', 'port_value'],
    ['SMTP_USERNAME', 'username'],
    ['SMTP_PASSWORD', 'password'],
    ['SMTP_FROM_ADDR', 'from_addr'],
    ['SMTP_FROM_NAME', 'from_name'],
    ['AUTH_JWT_SECRET', 'jwt_secret'],
    ['AUTH_JWT_ISSUER', 'auth_jwt_issuer'],
    ['AUTH_JWT_EXPIRATION_SECONDS', 'jwt_expiration'],
    ['APP_PUBLIC_URL', 'app_public_url'],
    ['AUTH_GOOGLE_ENABLED', 'google_enabled'],
  ]
  const googleBindings: Record<string, string> = {
    google_enabled: settings.auth_google_enabled ? 'Y' : 'N',
  }
  if (settings.auth_google_enabled) {
    for (const [id, bind] of [
      ['AUTH_GOOGLE_CLIENT_ID', 'auth_google_client_id'],
      ['AUTH_GOOGLE_CLIENT_SECRET', 'auth_google_client_secret'],
    ] as const satisfies ReadonlyArray<readonly [string, keyof SetupSettings]>) {
      googleBindings[bind] = String(settings[bind])
      settingWrites.push([
        id,
        bind,
        id === 'AUTH_GOOGLE_CLIENT_SECRET' ? ':google_secret_meta' : undefined,
      ])
    }
    const development = loopbackHostnames.includes(new URL(settings.app_public_url).hostname)
    googleBindings.auth_google_redirect_uri = deriveGoogleRedirectUri(
      settings.app_public_url,
      development ? undefined : new ConfigStore().getConfig().runtime?.apiUrl,
    )
    settingWrites.push(['AUTH_GOOGLE_REDIRECT_URI', 'auth_google_redirect_uri'])
    googleBindings.google_secret_meta = JSON.stringify({ secret: 'Y' })
  }
  const writes = settingWrites
    .map(
      ([id, bind, meta]) =>
        `  ${schema}.${odbSettings.write(odbLiteral(id), `:${bind}`, meta ?? 'NULL').toSQL()};`,
    )
    .join('\n')
  const googleAcl = settings.auth_google_enabled
    ? ['www.googleapis.com', 'oauth2.googleapis.com']
        .map((host) => `  ${schema}.${odbAcl.addHttp(odbLiteral(host), 443).toSQL()};`)
        .join('\n')
    : ''

  const sql = `BEGIN
${writes}
  ${schema}.${odbAcl.addSmtp(':host', ':port').toSQL()};
${googleAcl}
END;`

  await withConnection(buildConnectionConfig(false), async (_connection, executor) => {
    await executor.transaction(async (tx) => {
      const { auth_jwt_secret, auth_jwt_expiration_seconds } = settings
      const values = Object.fromEntries(
        Object.entries(settings).filter(([name]) => Object.hasOwn(validators, name)),
      )
      delete values.auth_jwt_expiration_seconds
      await tx.run(sql, {
        ...values,
        ...googleBindings,
        port_value: String(settings.port),
        jwt_secret: auth_jwt_secret ?? randomBytes(32).toString('hex'),
        jwt_expiration: String(auth_jwt_expiration_seconds),
      })
    })
  })
  if (settings.auth_google_enabled) {
    logger.info(
      `Register this Google OAuth redirect URI: ${googleBindings.auth_google_redirect_uri}`,
    )
  }
  logger.success(
    `SMTP, JWT, application URL, and Google settings saved and host ACLs updated for ${schema}.`,
  )
  return true
}
