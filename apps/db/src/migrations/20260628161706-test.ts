import {
  defineMigration,
  odbLiteral,
  odbLob,
  odbSettings,
  odbAudit,
  odbPackage,
  odbQuery,
} from '@odbvue/odb'

const schemaName = (process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? '').toUpperCase()

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
})

export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
})
  .install(odbLob)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbSettings.seed({ id: 'APP_VERSION', name: 'Application version', value: '1.0.0' }))
  .install(appPackage)
