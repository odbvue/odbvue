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
  it('installs storage and exposes owner-scoped upload, download, list and delete', async () => {
    const bootstrap = (await load('00000000000000-bootstrap')).compile().up().join('\n')
    expect(bootstrap).toContain('CREATE TABLE ODBVUE.odb_storage_files')
    expect(bootstrap).toContain('CREATE OR REPLACE PACKAGE ODBVUE.odb_storage AS')
    const migration = await load('00000000000001-sandbox')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('odb_storage.list(p_owner_id, p_after, p_limit, p_items)')
    expect(sql).toContain(
      'odb_storage.write(p_owner_id, p_file_name, p_mime_type, p_content, p_meta, p_id)',
    )
    expect(sql).toContain(
      'odb_storage.read(p_owner_id, p_id, l_file_name, l_mime_type, l_file_size, l_binary_content, l_meta)',
    )
    expect(sql).toContain('odb_storage.remove(p_owner_id, p_id)')
    expect(sql).not.toContain('odb_lob.base64_to_blob(p_content)')
    expect(sql).toContain('v_binary_body BLOB := :body')
    expect(sql).toContain('p_content => v_binary_body')
    expect(sql).not.toContain("JSON_VALUE(v_body, ''$.content'' RETURNING VARCHAR2(32767))")
    expect(sql).toContain('wpg_docload.download_file(l_binary_content)')
    expect(sql).toContain('Content-Disposition: attachment;')
    expect(sql).not.toContain('odb_lob.blob_to_base64(l_binary_content)')
    expect(sql).not.toContain('STORAGE_BASE64_INVALID')
    expect(sql).not.toContain('STORAGE_FILE_SIZE_MISMATCH')
    expect(sql).not.toContain('odb_storage_files')
    const openapi = generateApplicationOpenApi(migration.applications()[0]) as {
      paths: Record<
        string,
        Record<
          string,
          {
            security: unknown
            parameters?: { name: string }[]
            responses: Record<string, { content: unknown }>
          }
        >
      >
    }
    for (const [path, method] of [
      ['/sandbox/storage', 'post'],
      ['/sandbox/storage', 'get'],
      ['/sandbox/storage/{id}', 'get'],
      ['/sandbox/storage/{id}', 'delete'],
    ]) {
      const operation = openapi.paths[path!]?.[method!]
      expect(operation?.security).toEqual([{ bearerAuth: [] }])
      expect(operation?.parameters).not.toContainEqual(expect.objectContaining({ name: 'ownerId' }))
    }
    expect(openapi.paths['/sandbox/storage/{id}']?.get?.responses['200']?.content).toEqual({
      'application/octet-stream': { schema: { type: 'string', format: 'binary' } },
    })
    expect(openapi.paths['/sandbox/storage']?.post).toMatchObject({
      parameters: [
        { name: 'fileName', in: 'query' },
        { name: 'mimeType', in: 'query' },
        { name: 'meta', in: 'query' },
      ],
      requestBody: {
        content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
      },
    })
  })

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
    expect(sql).toContain("ODBVUE.odb_settings.write('SANDBOX_DEMO'")
  })

  it('installs the transport-independent odb_auth package in bootstrap', async () => {
    const sql = (await load('00000000000000-bootstrap')).compile().up().join('\n')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.odb_auth AS')
    expect(sql).toContain('odb_auth_crypto.verify_password(p_password, l_password_hash) = FALSE')
    expect(sql).toContain('IF l_presented_refresh_token_hash = l_previous_refresh_token_hash THEN')
    expect(sql).not.toContain('Set-Cookie')
    expect(sql).not.toContain('__Host-odb_refresh')
    expect(sql).not.toContain("p_base_path      => 'auth/'")
  })

  it('exposes auth and settings services from a single pck_sandbox package', async () => {
    const migration = await load('00000000000001-sandbox')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('CREATE OR REPLACE PACKAGE ODBVUE.PCK_SANDBOX_BLUE AS')
    expect(sql.match(/CREATE OR REPLACE PACKAGE (?:BODY )?ODBVUE\.\w+/g)).toHaveLength(2)

    // auth keeps its public URLs; cookies and headers are handled in the app package
    expect(sql).toContain("p_base_path      => 'auth/'")
    for (const route of ['login', 'refresh', 'logout', 'me']) {
      expect(sql).toContain(`p_pattern        => '${route}'`)
    }
    expect(sql).toContain('odb_auth.login(p_username, p_password, p_access_token, l_refresh_token)')
    expect(sql).toContain("p_set_cookie := '__Host-odb_refresh=' || l_refresh_token")
    expect(sql).toContain(
      "odb_auth.refresh(REGEXP_SUBSTR(p_cookie, '(^|;[[:space:]]*)__Host-odb_refresh=([^;]*)'",
    )
    expect(sql).toContain("p_name               => 'Set-Cookie'")

    // settings are authenticated and delegate to odb_settings
    expect(sql).toContain("p_base_path      => 'sandbox/'")
    expect(sql).toContain("p_pattern        => 'settings'")
    expect(sql).toContain("p_pattern        => 'settings/:id'")
    expect(sql).toContain(
      "odb_auth.require_user(REGEXP_SUBSTR(:odb_authorization, ''^Bearer[[:space:]]+(.+)$''",
    )
    expect(sql).toContain("odb_auth.has_role(v_auth_user_id, ''admin'')")
    expect(sql).not.toContain('p_authorization IN')
    expect(sql).toContain('odb_settings.list(p_after, p_limit, p_items)')
    expect(sql).toContain('odb_settings.read(p_id, p_value, p_meta)')
    expect(sql).toContain('odb_settings.write(p_id, p_value, NULL)')
    expect(sql).toContain('odb_settings.remove(p_id)')
    expect(sql).not.toContain("ODBVUE.odb_settings.write('SANDBOX_DEMO'")
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

  it('exposes authenticated audit listing and severity actions', async () => {
    const migration = await load('00000000000001-sandbox')
    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('odb_audit.list(p_after, p_limit, p_items)')
    expect(sql).toContain('odb_audit.info(p_message)')
    expect(sql).toContain('odb_audit.warn(p_message)')
    expect(sql).toMatch(/WHEN OTHERS THEN\s+odb_audit.error\(p_message\);\s+RAISE;/)
    expect(sql).toContain('SANDBOX_AUDIT_ERROR')
    expect(sql).toContain('AUDIT_MESSAGE_REQUIRED')
    expect(sql).not.toContain('odb_audit_logs')
    const openapi = generateApplicationOpenApi(migration.applications()[0]) as {
      paths: Record<
        string,
        Record<string, { parameters: { name: string; in: string }[]; security: unknown }>
      >
    }
    const list = openapi.paths['/sandbox/audit']?.get
    expect(list).toBeDefined()
    expect(
      list?.parameters.filter((parameter) => parameter.in === 'query').map((p) => p.name),
    ).toEqual(['cursor', 'limit'])
    for (const severity of ['info', 'warn', 'error']) {
      const action = openapi.paths[`/sandbox/audit/${severity}`]?.post
      expect(action).toBeDefined()
      expect(action?.security).toEqual([{ bearerAuth: [] }])
      expect(action?.parameters).not.toContainEqual(
        expect.objectContaining({ name: 'Authorization' }),
      )
    }
  })

  it('keeps settings meta typed as JSON and lists with limit/cursor query parameters', async () => {
    const migration = await load('00000000000001-sandbox')
    const openapi = generateApplicationOpenApi(migration.applications()[0]) as {
      paths: Record<string, Record<string, { parameters: { name: string; in: string }[] }>>
      components: { schemas: Record<string, { properties: Record<string, unknown> }> }
    }
    expect(openapi.components.schemas.SandboxReadSettingResponse?.properties.meta).toEqual({
      'x-odb-type': 'json',
    })
    expect(openapi.components.schemas.SandboxListSettingsResponse?.properties).toHaveProperty(
      'items',
    )
    const parameters = openapi.paths['/sandbox/settings']?.get?.parameters ?? []
    expect(parameters.filter((parameter) => parameter.in === 'query').map((p) => p.name)).toEqual([
      'cursor',
      'limit',
    ])

    const sql = migration.compile().up().join('\n')
    expect(sql).toContain('list_settings(p_after => :after')
  })

  it('seeds an admin grant and an unprivileged test user in bootstrap', async () => {
    const sql = (await load('00000000000000-bootstrap')).compile().up().join('\n')
    expect(sql).toContain('CREATE TABLE ODBVUE.odb_auth_user_roles')
    expect(sql).toContain("ODBVUE.odb_auth.define_role('admin'")
    expect(sql).toContain("ODBVUE.odb_auth.grant_role(v_user_id, 'admin')")
    expect(sql).toContain("'test@odbvue.com'")
    expect(sql).toContain("ODBVUE.odb_auth_crypto.hash_password('MySecurePass123!')")
    expect(sql.match(/ODBVUE\.odb_auth\.grant_role\(/g)).toHaveLength(1)
    const grants = sql.match(/DECLARE v_user_id[\s\S]*?END;\n\//g)
    expect(grants).toHaveLength(1)
    expect(grants?.[0]).toContain("'admin@odbvue.com'")
    expect(grants?.[0]).not.toContain("'test@odbvue.com'")
  })
})
