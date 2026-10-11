import { readFile } from 'node:fs/promises'
import prompts, { type PromptObject } from 'prompts'

import { odbDbmsNetworkAclAdmin, odbSettings, withConnection } from '@odbvue/odb'

import { SecretsStore } from '../adapters/secrets-store.js'
import { logger } from '../shared/logger.js'
import { buildConnectionConfig } from './db-exec.js'

type SmtpSettings = {
  host: string
  port: number
  username: string
  password: string
  from_addr: string
  from_name: string
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
}

const settingsValid = (settings: Record<string, unknown>): settings is SmtpSettings =>
  Object.entries(validators).every(([name, validate]) => validate(settings[name]))

export const runSetupSettings = async (file?: string): Promise<boolean> => {
  const fileSettings: Record<string, unknown> = {}
  if (file !== undefined) {
    const values: unknown = JSON.parse(await readFile(file, 'utf-8'))
    if (values === null || typeof values !== 'object' || Array.isArray(values)) {
      throw new Error('SMTP settings file must contain a JSON object')
    }
    for (const [key, value] of Object.entries(values)) {
      const normalized = key.toLowerCase()
      const name = normalized.slice('smtp_'.length)
      if (!normalized.startsWith('smtp_') || !Object.hasOwn(validators, name)) {
        throw new Error(`Unknown SMTP setting key: ${key}`)
      }
      if (Object.hasOwn(fileSettings, name)) {
        throw new Error(`Duplicate SMTP setting key (case-insensitive): ${key}`)
      }
      if (!validators[name]!(value)) {
        throw new Error(`Invalid SMTP setting: ${key}; no settings or ACLs were changed`)
      }
      fileSettings[name] = value
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
    throw new Error('Invalid SMTP settings; no settings or ACLs were changed')
  }

  const schema = new SecretsStore().get('ODBVUE_ADB_SCHEMA_USERNAME')?.trim().toUpperCase()
  if (!schema || !/^[A-Z][A-Z0-9_$#]{0,127}$/.test(schema)) {
    throw new Error('A valid schema username is required in ODBVUE_ADB_SCHEMA_USERNAME')
  }

  const ace =
    "XS$ACE_TYPE(privilege_list => XS$NAME_LIST('smtp'), principal_name => :schema, principal_type => XS_ACL.PTYPE_DB)"
  const append = odbDbmsNetworkAclAdmin
    .appendHostAce(':host', ace, {
      lowerPort: ':port',
      upperPort: ':port',
    })
    .toSQL()
  const remove = odbDbmsNetworkAclAdmin
    .removeHostAce('l_old_host', ace, {
      lowerPort: 'l_old_port',
      upperPort: 'l_old_port',
    })
    .toSQL()
  const writes = [
    ['SMTP_HOST', 'host'],
    ['SMTP_PORT', 'port_value'],
    ['SMTP_USERNAME', 'username'],
    ['SMTP_PASSWORD', 'password'],
    ['SMTP_FROM_ADDR', 'from_addr'],
    ['SMTP_FROM_NAME', 'from_name'],
  ]
    .map(([id, bind]) => `  ${schema}.${odbSettings.write(`'${id}'`, `:${bind}`).toSQL()};`)
    .join('\n')

  const sql = `DECLARE
  l_old_host VARCHAR2(2000);
  l_old_port_value VARCHAR2(2000);
  l_old_port PLS_INTEGER;
  l_meta CLOB;
  l_count PLS_INTEGER;
BEGIN
  ${schema}.${odbSettings.read("'SMTP_HOST'", 'l_old_host', 'l_meta').toSQL()};
  ${schema}.${odbSettings.read("'SMTP_PORT'", 'l_old_port_value', 'l_meta').toSQL()};
  IF l_old_host IS NOT NULL AND regexp_like(l_old_port_value, '^[0-9]{1,5}$') THEN
    l_old_port := to_number(l_old_port_value);
    IF l_old_host <> :host OR l_old_port <> :port THEN
      SELECT count(*) INTO l_count FROM dba_host_aces
      WHERE host = l_old_host AND lower_port = l_old_port AND upper_port = l_old_port
        AND principal = :schema AND lower(privilege) = 'smtp' AND grant_type = 'GRANT';
      IF l_count > 0 THEN
        ${remove};
      END IF;
    END IF;
  END IF;
  ${append};
${writes}
END;`

  await withConnection(buildConnectionConfig(false), async (_connection, executor) => {
    await executor.transaction(async (tx) => {
      await tx.run(sql, { ...settings, port_value: String(settings.port), schema })
    })
  })
  logger.success(`SMTP settings saved and host ACL updated for ${schema}.`)
  return true
}
