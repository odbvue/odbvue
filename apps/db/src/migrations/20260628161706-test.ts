import {
  odbEnv,
  defineMigration,
  //odbLiteral,
  odbLob,
  odbSettings,
  odbAudit,
  odbPackage,
  odbTable,
} from '@odbvue/odb'
//import { appMigrationsTable } from './00000000000000-initial.js'

const schemaName = odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME')

export const appUsersTable = odbTable('app_users', (t) => ({
  id: t.number().identity().primaryKey().comment('Primary Key'),
  uuid: t.guid().defaultSysGuid(),
  status: t.string(1).default('N').notNull(),
  username: t.string(240).notNull(),
  password: t.string(240).notNull(),
  fullname: t.string(240).notNull(),
  created: t.timestamp().defaultSysTimestamp().notNull(),
  attempts: t.number().default(0).notNull(),
  accessed: t.timestamp(),
  attempted: t.timestamp(),
}))
  .comment('Application users table')
  .unique((c) => [c.uuid])
  .unique((c) => [c.username])
  .check((c, e) => e.in(c.status, ['A', 'D', 'N']))

const appPackage = odbPackage('pck_app', (p) => {
  p.proc('bootstrap', (proc) => {
    const { username, password } = proc.inputs({
      username: appUsersTable.username,
      password: appUsersTable.password,
    })

    proc
      .body((body) => {
        body
          .insertInto(appUsersTable, {
            username,
            password,
            fullname: 'Bootstrap Admin',
            status: 'A',
          })
          .auditInfo('Bootstrap admin user created', { 'user.name': username })
      })
      .service({
        method: 'POST',
        path: '/bootstrap',
        summary: 'Bootstraps the admin user',
      })
  })
})

/*
// Hardcoded bootstrap admin. The password is stored as pck_api_auth.pwd() will
// later verify it: a 32-char random salt followed by SHA-256(trim(password) || salt).
// Username is upper/trimmed to match auth's WHERE use
// rname = upper(trim(...)).



const appPackage = odbPackage('pck_app', (p) => {
  p.proc('me', (proc) => {
    const version = proc.out('version', 'VARCHAR2')
    const versionBase64 = proc.out('version_base64', 'CLOB')

    proc.body((body) =>
      body
        .auditEvent('version info requested')
        .selectInto(
          version,
          odbQuery()
            .selectFrom('dual')
            .select(odbSettings.read(odbLiteral('APP_VERSION'))),
        )
        .assign(versionBase64, odbLob.varchar2ToBase64(version.toSQL())),
    )

    proc.service({
      method: 'GET',
      path: '/auth/me',
      summary: 'Returns the current application version (plus its Base64 encoding)',
    })
  })

  p.proc('migrations', (proc) => {
    const result = proc.out('result', 'SYS_REFCURSOR')

    proc.body((body) =>
      body.openFor(
        result,
        odbQuery()
          .selectFrom(appMigrationsTable)
          .select([appMigrationsTable.created, appMigrationsTable.migrationName]),
      ),
    )

    proc.service({
      method: 'GET',
      path: '/migrations',
      summary: 'Returns all applied database migrations',
    })
  })

  p.proc('login', (proc) => {
    const username = proc.in('p_username', 'app_users.username%TYPE')
    const password = proc.in('p_password', 'app_users.password%TYPE')
    const accessToken = proc.out('r_access_token', 'app_tokens.token%TYPE')
    const refreshToken = proc.out('r_refresh_token', 'app_tokens.token%TYPE')

    // Auth runtime (auth/issue_token/revoke_token/http) is not yet ported to this
    // repo; called by name via raw() until an odb auth package exists.
    proc.body((body) => {
      const uuid = body.variable('v_uuid', 'app_users.uuid%TYPE')
      const status = body.variable('v_status', 'PLS_INTEGER')

      body
        .raw(`pck_api_auth.auth(${username.name}, ${password.name}, ${uuid.name}, ${status.name})`)
        .ifThen(
          `${status.name} = 200`,
          (t) =>
            t
              .assign(accessToken, `pck_api_auth.issue_token(${uuid.name}, 'ACCESS')`)
              .raw(`pck_api_auth.revoke_token(${uuid.name}, 'REFRESH')`)
              .assign(refreshToken, `pck_api_auth.issue_token(${uuid.name}, 'REFRESH')`)
              .auditInfo('Login success', {
                'user.name': username.name,
                'user.id': uuid.name,
                'http.response.status_code': status.name,
              }),
          (e) =>
            e.auditWarn('Login error', {
              'user.name': username.name,
              'http.response.status_code': status.name,
            }),
        )
        .raw(`pck_api_auth.http(${status.name})`)
        .whenOthers((h) =>
          h
            .assign(accessToken, 'NULL')
            .assign(refreshToken, 'NULL')
            .auditError('Login error', { 'user.name': username.name })
            .raw('pck_api_auth.http(401)'),
        )
    })

    proc.service({
      method: 'POST',
      path: '/auth/login',
      summary: 'Authenticates a user and issues access and refresh tokens',
    })
  })

  p.proc('logout', (proc) => {
    proc.body((body) => {
      const uuid = body
        .variable('v_uuid', 'app_users.uuid%TYPE')
        .assign(`coalesce(pck_api_auth.uuid, pck_api_auth.refresh('refresh_token'))`)

      body
        .raw(`pck_api_auth.revoke_token(${uuid.name}, 'ACCESS')`)
        .raw(`pck_api_auth.revoke_token(${uuid.name}, 'REFRESH')`)
        .ifThen(`${uuid.name} IS NOT NULL`, (t) =>
          t.auditInfo('Logout success', { 'user.id': uuid.name }),
        )
        .whenOthers((h) => h.auditError('Logout error', { 'user.id': uuid.name }))
    })

    proc.service({
      method: 'POST',
      path: '/auth/logout',
      summary: 'Revokes the current user access and refresh tokens',
    })
  })

  p.proc('refresh', (proc) => {
    const accessToken = proc.out('r_access_token', 'app_tokens.token%TYPE')
    const refreshToken = proc.out('r_refresh_token', 'app_tokens.token%TYPE')

    proc.body((body) => {
      const uuid = body
        .variable('v_uuid', 'app_users.uuid%TYPE')
        .assign(`pck_api_auth.refresh('refresh_token')`)

      body
        .ifThen(
          `${uuid.name} IS NULL`,
          (t) => t.raw('pck_api_auth.http_401'),
          (e) =>
            e
              .assign(accessToken, `pck_api_auth.issue_token(${uuid.name}, 'ACCESS')`)
              .assign(refreshToken, `pck_api_auth.issue_token(${uuid.name}, 'REFRESH')`),
        )
        .whenOthers((h) =>
          h
            .assign(accessToken, 'NULL')
            .assign(refreshToken, 'NULL')
            .auditError('Refresh error', { 'user.id': uuid.name })
            .raw('pck_api_auth.http_401'),
        )
    })

    proc.service({
      method: 'POST',
      path: '/auth/refresh',
      summary: 'Issues new access and refresh tokens from a valid refresh token',
    })
  })
})
*/
export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
})
  .install(odbLob)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbSettings.seed({ id: 'APP_VERSION', name: 'Application version', value: '1.0.0' }))
  .install(appUsersTable)
  .install(appPackage)
