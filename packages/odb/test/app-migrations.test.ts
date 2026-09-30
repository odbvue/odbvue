import { beforeAll, describe, expect, it } from 'vitest'
import { generateApplicationOpenApi } from '../src/application.js'

beforeAll(() => {
  process.env.ODBVUE_ADB_SCHEMA_USERNAME = 'ODBVUE'
  process.env.ODBVUE_ADB_SCHEMA_PASSWORD = 'test-password'
})

const migrations = {
  '00000000000000-bootstrap': () =>
    import('../../../apps/db/src/migrations/00000000000000-bootstrap.js'),
  '00000000000001-sandbox': () =>
    import('../../../apps/db/src/migrations/00000000000001-sandbox.js'),
}

const load = async (file: keyof typeof migrations) => (await migrations[file]()).migration

describe('app-owned ORDS migrations', () => {
  it('keeps auth and settings routes out of bootstrap', async () => {
    const sql = (await load('00000000000000-bootstrap')).compile().up().join('\n')
    expect(sql).not.toContain("p_base_path      => 'auth/'")
    expect(sql).not.toContain("p_base_path      => 'secrets/'")
    expect(sql).not.toContain("p_base_path      => 'settings/'")
    expect(sql).not.toContain('CREATE OR REPLACE PACKAGE ODBVUE.PCK_SECRETS_BLUE AS')
    expect(sql).not.toContain('CREATE OR REPLACE SYNONYM ODBVUE.pck_secrets')
  })

  it('installs the odb_settings package with its table and seed in bootstrap', async () => {
    const sql = (await load('00000000000000-bootstrap')).compile().up().join('\n')
    expect(sql).toContain('CREATE TABLE ODBVUE.odb_settings_store')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.odb_settings AS')
    expect(sql).toContain("ODBVUE.odb_settings.write('APP_VERSION', '1.0.0'")
  })

  it('installs the odb_auth package in bootstrap', async () => {
    const sql = (await load('00000000000000-bootstrap')).compile().up().join('\n')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.odb_auth AS')
    expect(sql).toContain('odb_auth_crypto.verify_password(p_password, l_password_hash) = FALSE')
    expect(sql).toContain('IF l_presented_refresh_token_hash = l_previous_refresh_token_hash THEN')
  })

  it('exposes auth and settings services from a single pck_sandbox package', async () => {
    const migration = await load('00000000000001-sandbox')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.PCK_SANDBOX_BLUE AS')
    expect(sql.match(/CREATE OR REPLACE PACKAGE (?:BODY )?ODBVUE\.\w+/g)).toHaveLength(2)

    // auth keeps its public URLs and delegates to odb_auth
    expect(sql).toContain("p_base_path      => 'auth/'")
    for (const route of ['login', 'refresh', 'logout', 'me']) {
      expect(sql).toContain(`p_pattern        => '${route}'`)
    }
    expect(sql).toContain('odb_auth.login(p_username, p_password, p_access_token, p_set_cookie)')
    expect(sql).toContain("p_name               => 'Set-Cookie'")

    // settings are authenticated and delegate to odb_settings
    expect(sql).toContain("p_base_path      => 'sandbox/'")
    expect(sql).toContain("p_pattern        => 'settings'")
    expect(sql).toContain("p_pattern        => 'settings/:id'")
    expect(sql).toContain('odb_auth_jwt.require_user(p_authorization)')
    expect(sql).toContain('odb_settings.list(p_after, 10, p_items)')
    expect(sql).toContain('odb_settings.read(p_id, p_value, p_meta)')
    expect(sql).toContain('odb_settings.write(p_id, p_value, NULL)')
    expect(sql).toContain('odb_settings.remove(p_id)')
    expect(sql).toContain("ODBVUE.odb_settings.write('SANDBOX_DEMO'")
    expect(sql).not.toContain('odb_settings_store')
  })

  it('keeps the auth OpenAPI contract free of cookies', async () => {
    const migration = await load('00000000000001-sandbox')
    const openapi = generateApplicationOpenApi(migration.applications()[0]) as {
      components: { schemas: Record<string, { properties: Record<string, unknown> }> }
    }
    const schemas = Object.entries(openapi.components.schemas)
    const login = schemas.find(([name]) => name.endsWith('LoginResponse'))?.[1]
    expect(login?.properties).toMatchObject({ accessToken: { type: 'string' } })
    expect(login?.properties).not.toHaveProperty('refreshToken')
    expect(login?.properties).not.toHaveProperty('setCookie')
  })
})
