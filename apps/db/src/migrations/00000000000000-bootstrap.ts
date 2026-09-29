import {
  defineMigration,
  odbAuth,
  odbEnv,
  odbHttp,
  odbLob,
  odbRateLimit,
  odbSchema,
  odbSettings,
  odbAudit,
  odbPackage,
  odbTable,
  odbType,
  defineService,
} from '@odbvue/odb'

const schemaName = odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME')
const schemaPassword = odbEnv.read('ODBVUE_ADB_SCHEMA_PASSWORD')

const appUsersTable = odbTable('app_users', (t) => ({
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
  const bootstrap = p.proc(
    'bootstrap',
    {
      in: {
        username: appUsersTable.username,
        password: appUsersTable.password,
      },
    },
    ({ params: { username, password }, body }) => {
      body
        .insertInto(appUsersTable, {
          username,
          password,
          fullname: 'Bootstrap Admin',
          status: 'A',
        })
        .auditInfo('Bootstrap admin user created', { 'user.name': username })
        .whenOthers((handler) =>
          handler.auditError('Bootstrap admin user creation failed', { 'user.name': username }),
        )
    },
  )
  defineService(bootstrap, {
    method: 'POST',
    path: '/bootstrap',
    summary: 'Bootstraps the admin user',
    body: { username: bootstrap.parameters.username, password: bootstrap.parameters.password },
  })
})

const testPackage = odbPackage('pck_test', (pkg) => {
  const test = pkg.proc('test', { out: { result: odbType.string() } }, ({ params, body }) =>
    body.set(params.result, 'OK'),
  )
  defineService(test, {
    method: 'GET',
    path: '/test',
    response: { result: test.parameters.result },
  })
})

export const schema = odbSchema(schemaName, schemaPassword, (definition) => {
  definition.grant('EXECUTE ON DBMS_CRYPTO')
  definition.grant('EXECUTE ON UTL_ENCODE')
  definition.grant('EXECUTE ON UTL_I18N')
  definition.grant('EXECUTE ON UTL_INADDR')
  definition.grant('EXECUTE ON UTL_TCP')
})

export const migration = defineMigration('00000000000000_bootstrap', {
  schema: schemaName,
})
  .install(odbHttp)
  .install(odbRateLimit)
  .install(odbAuth)
  .install(odbAuth.api())
  .install(odbSettings)
  .install(odbLob)
  .install(odbAudit)
  .install(
    odbSettings.seed({
      id: 'APP_VERSION',
      value: '1.0.0',
      meta: { label: 'Application version', type: 'string' },
    }),
  )
  .install(appUsersTable)
  .install(appPackage)
  .install(testPackage)
  .install(
    odbAuth.seedUser({
      username: 'admin',
      password: odbEnv.read('ODBVUE_AUTH_INITIAL_PASSWORD', 'ChangeMe123!'),
      displayName: 'Administrator',
    }),
  )
