import { afterEach, describe, expect, it } from 'vitest'
import { odbEnv } from '../src/env.js'

const ENV_NAME = 'ODBVUE_TEST_ENV'

afterEach(() => {
  delete process.env[ENV_NAME]
  delete process.env.ODBVUE_ADB_SCHEMA_USERNAME
  delete process.env.ODBVUE_ADB_SCHEMA_PASSWORD
})

describe('odbEnv', () => {
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

  it('reads the schema credentials through adb getters', () => {
    process.env.ODBVUE_ADB_SCHEMA_USERNAME = 'APP'
    process.env.ODBVUE_ADB_SCHEMA_PASSWORD = 'secret'

    expect(odbEnv.adb.schemaUsername).toBe('APP')
    expect(odbEnv.adb.schemaPassword).toBe('secret')
  })

  it('throws with the variable name when an adb value is not set', () => {
    expect(() => odbEnv.adb.schemaUsername).toThrow(
      'ODBVUE_ADB_SCHEMA_USERNAME environment variable is not set',
    )
  })
})
