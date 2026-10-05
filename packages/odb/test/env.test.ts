import { afterEach, describe, expect, it } from 'vitest'
import { odbEnv } from '../src/env.js'

const ENV_NAME = 'ODBVUE_TEST_ENV'

afterEach(() => {
  delete process.env[ENV_NAME]
  delete process.env.ODBVUE_ADB_SCHEMA_USERNAME
  delete process.env.ODBVUE_ADB_SCHEMA_PASSWORD
  delete process.env.ODBVUE_APP_ADMIN_USERNAME
  delete process.env.ODBVUE_APP_ADMIN_PASSWORD
})

describe('odbEnv', () => {
  it('reads the application admin credentials through getters', () => {
    process.env.ODBVUE_APP_ADMIN_USERNAME = 'owner@example.com'
    process.env.ODBVUE_APP_ADMIN_PASSWORD = 'CustomSecure123!'

    expect(odbEnv.appUsername).toBe('owner@example.com')
    expect(odbEnv.appPassword).toBe('CustomSecure123!')
  })

  it('throws with the variable name when application admin credentials are not set', () => {
    expect(() => odbEnv.appUsername).toThrow(
      'ODBVUE_APP_ADMIN_USERNAME environment variable is not set',
    )
    expect(() => odbEnv.appPassword).toThrow(
      'ODBVUE_APP_ADMIN_PASSWORD environment variable is not set',
    )
  })

  it('reads a set environment variable', () => {
    process.env[ENV_NAME] = 'value'

    expect(odbEnv.read(ENV_NAME)).toBe('value')
  })

  it('throws when a required environment variable is not set', () => {
    expect(() => odbEnv.read(ENV_NAME)).toThrow(`${ENV_NAME} environment variable is not set`)
  })

  it('returns the default when the environment variable is not set', () => {
    expect(odbEnv.read(ENV_NAME, 'ABC')).toBe('ABC')
  })

  it('reads the schema credentials through getters', () => {
    process.env.ODBVUE_ADB_SCHEMA_USERNAME = 'APP'
    process.env.ODBVUE_ADB_SCHEMA_PASSWORD = 'secret'

    expect(odbEnv.schemaUsername).toBe('APP')
    expect(odbEnv.schemaPassword).toBe('secret')
  })

  it('throws with the variable name when schema credentials are not set', () => {
    expect(() => odbEnv.schemaUsername).toThrow(
      'ODBVUE_ADB_SCHEMA_USERNAME environment variable is not set',
    )
    expect(() => odbEnv.schemaPassword).toThrow(
      'ODBVUE_ADB_SCHEMA_PASSWORD environment variable is not set',
    )
  })
})
