import { beforeAll, describe, expect, it } from 'vitest'
import { generateApplicationOpenApi } from '../src/application.js'

beforeAll(() => {
  process.env.ODBVUE_ADB_SCHEMA_USERNAME = 'ODBVUE'
  process.env.ODBVUE_ADB_SCHEMA_PASSWORD = 'test-password'
})

describe('app-owned ORDS migrations', () => {
  it('keeps framework auth and sandbox secrets routes out of bootstrap', async () => {
    const { migration } =
      await import('../../../apps/db/src/migrations/00000000000000-bootstrap.js')
    const sql = migration.compile().up().join('\n')
    expect(sql).not.toContain("p_base_path      => 'auth/'")
    expect(sql).not.toContain("p_base_path      => 'secrets/'")
    expect(sql).not.toContain('CREATE OR REPLACE PACKAGE ODBVUE.odb_auth AS')
    expect(sql).not.toContain('CREATE OR REPLACE PACKAGE ODBVUE.PCK_SECRETS_BLUE AS')
    expect(sql).not.toContain('CREATE OR REPLACE SYNONYM ODBVUE.pck_secrets')
  })

  it('registers auth routes with their existing request and response contracts', async () => {
    const { migration } = await import('../../../apps/db/src/migrations/00000000000001-auth.js')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.odb_auth AS')
    expect(sql).toContain("p_base_path      => 'auth/'")
    expect(sql).toContain("p_pattern        => 'login'")
    expect(sql).toContain("p_pattern        => 'refresh'")
    expect(sql).toContain("p_pattern        => 'logout'")
    expect(sql).toContain("p_pattern        => 'me'")
    expect(sql).toContain("p_name               => 'Set-Cookie'")
    expect(sql).toContain("p_name               => 'accessToken'")
    expect(sql).toContain(
      "p_login_username => JSON_VALUE(v_body, ''$.username'' RETURNING VARCHAR2(32767))",
    )
    expect(sql).toContain('odb_auth_crypto.verify_password(p_password, l_password_hash) = FALSE')
    expect(sql).toContain('IF l_presented_refresh_token_hash = l_previous_refresh_token_hash THEN')
    const application = migration.applications()[0]
    const openapi = generateApplicationOpenApi(application) as {
      components: { schemas: Record<string, { properties: Record<string, unknown> }> }
    }
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).toMatchObject({
      accessToken: { type: 'string' },
    })
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).not.toHaveProperty(
      'refreshToken',
    )
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).not.toHaveProperty(
      'setCookie',
    )
    expect(openapi.components.schemas.OdbAuthMeResponse.properties).toMatchObject({
      userId: { type: 'string' },
      displayName: { type: 'string' },
    })
  })

  it('installs settings services for regular and secret settings', async () => {
    const { migration } =
      await import('../../../apps/db/src/migrations/00000000000002-sandbox-settings.js')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.ODB_SETTINGS_API_BLUE AS')
    expect(sql).not.toContain('PCK_SECRETS_BLUE')
    expect(sql).toContain("p_base_path      => 'settings/'")
    expect(sql).toContain("p_pattern        => ':id'")
    expect(sql).toContain("p_pattern        => 'secret/:id'")
    expect(sql.match(/ords\.define_template\(/g)).toHaveLength(2)
    expect(sql.match(/p_method         => 'GET'/g)).toHaveLength(2)
    expect(sql.match(/p_method         => 'PUT'/g)).toHaveLength(2)
    expect(sql).toContain('odb_settings.read_regular(p_id)')
    expect(sql).toContain('odb_settings.read_secret(p_id)')
    expect(sql).toContain("odb_settings.write(p_id, p_id, p_value, NULL, 'N')")
    expect(sql).toContain("odb_settings.write(p_id, p_id, p_value, NULL, 'Y')")
  })
})
