import { describe, expect, it } from 'vitest'
import { generateApplicationOpenApi } from '../../../src/application.js'
import { defineMigration } from '../../../src/migration.js'
import { odbAuth } from '../../../src/packages/framework/auth/auth.js'

describe('odbAuth framework package', () => {
  it('emits tables, primitives, and ORDS auth endpoints', () => {
    const sql = odbAuth.toSQLUp({ schema: 'APP', jwtSecret: 'x'.repeat(32) })
    expect(sql).toContain('CREATE TABLE APP.odb_auth_users')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_crypto AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth_jwt AS')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE APP.odb_auth AS')
    expect(sql).toContain(
      'PROCEDURE login(p_login_username IN odb_auth_users.username%TYPE, p_password IN VARCHAR2',
    )
    expect(sql).toContain('odb_auth_crypto.hash_token')
    expect(sql).toContain('FOR UPDATE')
  })

  it('registers the auth API with ORDS when installed by a migration', () => {
    const sql = defineMigration('auth', { schema: 'APP' })
      .install(odbAuth)
      .compile()
      .up()
      .join('\n')
    expect(sql).toContain("p_base_path      => 'auth/'")
    expect(sql).toContain("p_pattern        => 'login'")
    expect(sql).toContain("p_pattern        => 'refresh'")
    expect(sql).toContain("p_pattern        => 'me'")
  })

  it('publishes token-only login and refresh response contracts to OpenAPI', () => {
    const openapi = generateApplicationOpenApi(odbAuth.application()) as {
      components: { schemas: Record<string, { properties: Record<string, unknown> }> }
    }

    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).toMatchObject({
      accessToken: { type: 'string' },
      refreshToken: { type: 'string' },
    })
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).not.toHaveProperty('userId')
    expect(openapi.components.schemas.OdbAuthLoginResponse.properties).not.toHaveProperty(
      'username',
    )
  })

  it('seeds an idempotent default user through the crypto package', () => {
    const sql = odbAuth
      .seedUser({ username: 'admin', password: 'secret', displayName: 'Admin' })
      .toSQLUp({ schema: 'APP' })
    expect(sql).toContain('MERGE INTO APP.odb_auth_users')
    expect(sql).toContain("APP.odb_auth_crypto.hash_password('secret')")
  })
})
