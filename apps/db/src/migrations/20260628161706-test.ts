import { defineMigration, odbLob, odbPackage } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('version', (proc) => {
    const version = proc.out('version', 'VARCHAR2')
    const test = proc.out('test', 'CLOB')

    proc.body((body) => {
      const vVersion = body.varchar2('v_version', 200).value('1.0.1')

      body.set(version, vVersion)
      body.set(test, vVersion.toBase64())
    })

    proc.service({
      method: 'GET',
      path: '/version',
      summary: 'Returns the application version',
    })
  })
})

export const migration = defineMigration('20260628161706_test', {
  schema: schemaName,
  version: '1.0.1',
})
  .install(odbLob)
  .install(appPackage)
  .expose(appPackage)
