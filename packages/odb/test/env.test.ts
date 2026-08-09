import { afterEach, describe, expect, it } from 'vitest'
import { odbEnv } from '../src/env.js'

const ENV_NAME = 'ODBVUE_TEST_ENV'

afterEach(() => {
  delete process.env[ENV_NAME]
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
})
