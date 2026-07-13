import { defineMigration, odbLob, odbPackage, odbOrdsSchema } from '@odbvue/odb'

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

export const migration = defineMigration('20260628161706_test', '1.0.1')
  .up(() => {
    return [
      odbLob.toSQLUp({ schema: schemaName }),
      appPackage.toSQLUp({ schema: schemaName }),
      odbOrdsSchema(schemaName).toSQLUp(),
      appPackage.toOrdsSQL({ schema: schemaName }),
    ]
  })
  .down(() => {
    return [
      appPackage.toOrdsDownSQL({ schema: schemaName }),
      appPackage.toSQLDown({ schema: schemaName }),
      odbLob.toSQLDown({ schema: schemaName }),
    ]
  })
