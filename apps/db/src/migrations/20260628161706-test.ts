import {
  odbEnv,
  defineMigration,
  odbLob,
  odbSettings,
  odbAudit,
  odbPackage,
  odbTable,
} from '@odbvue/odb'

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
          .whenOthers((h) =>
            h.auditError('Bootstrap admin user creation failed', { 'user.name': username }),
          )
      })
      .service({
        method: 'POST',
        path: '/bootstrap',
        summary: 'Bootstraps the admin user',
      })
  })
})

export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
  tag: '1.0.0',
})
  .install(odbLob)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbSettings.seed({ id: 'APP_VERSION', name: 'Application version', value: '1.0.0' }))
  .install(appUsersTable)
  .install(appPackage)
