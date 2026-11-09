import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('application bootstrap authentication policy', () => {
  it.each([
    ['development', 'N'],
    ['production', 'Y'],
    ['test', 'Y'],
    [undefined, 'Y'],
  ])('with NODE_ENV %s sets two-factor to %s', async (environment, expected) => {
    vi.stubEnv('NODE_ENV', environment)
    vi.stubEnv('ODBVUE_ADB_SCHEMA_USERNAME', 'ODBVUE')
    vi.stubEnv('ODBVUE_ADB_SCHEMA_PASSWORD', 'test-password')
    vi.stubEnv('ODBVUE_APP_ADMIN_USERNAME', 'owner@example.com')
    vi.stubEnv('ODBVUE_APP_ADMIN_PASSWORD', 'CustomSecure123!')
    vi.resetModules()

    const { migration } =
      await import('../../../apps/db/src/migrations/00000000000000-bootstrap.js')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain(`odb_settings.write('AUTH_TWO_FACTOR_ENABLED', '${expected}'`)
    for (const feature of ['PASSWORD', 'GOOGLE', 'SIGNUP']) {
      expect(sql).toContain(`odb_settings.write('AUTH_${feature}_ENABLED', 'Y'`)
    }
    expect(sql).toContain("odb_settings.write('AUTH_LDAP_ENABLED', 'N'")
  })
})
