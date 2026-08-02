import { defineMigration, odbLiteral, odbLob, odbAudit, odbPackage, odbQuery, odbTable } from '@odbvue/odb'

const schemaName = (process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? '').toUpperCase()

const appSettingsTable = odbTable('app_settings', (t) => {
  t.string('id', 30).notNull().primaryKey()
  t.string('name', 200).notNull()
  t.string('value', 2000)
  t.clob('options')
  t.string('secret', 1).default("'N'").notNull()
})

const appSettingsSeedQuery = odbQuery().insertInto(appSettingsTable).values({
  id: 'APP_VERSION',
  name: 'APP_VERSION',
  value: '1.0.0',
  secret: 'N',
})

const settingsPackage = odbPackage('pck_api_settings', (p) => {
  p.func('get_value', 'VARCHAR2', (fn) => {
    const pId = fn.in('p_id', 'VARCHAR2')

    fn.body((body) =>
      body.returnQuery(
        odbQuery().selectFrom(appSettingsTable).select('value').where('id', '=', pId),
      ),
    )
  })
})

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('me', (proc) => {
    const version = proc.out('version', 'VARCHAR2')
    const versionBase64 = proc.out('version_base64', 'CLOB')

    proc.body((body) =>
      body
        .auditEvent('version info requested')
        .selectInto(
          version,
          odbQuery()
            .selectFrom('dual')
            .select(settingsPackage.call('get_value', odbLiteral('APP_VERSION'))),
        )
        .assign(versionBase64, odbLob.varchar2ToBase64(version.toSQL())),
    )

    proc.service({
      method: 'GET',
      path: '/auth/me',
      summary: 'Returns the current application version (plus its Base64 encoding)',
    })
  })
})

export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
})
  .install(odbLob)
  .install(odbAudit)
  .install(appSettingsTable)
  .install(settingsPackage)
  .install(appPackage)
  .upQuery(appSettingsSeedQuery)
