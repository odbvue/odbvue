import { defineMigration, odbLob, odbPackage, odbOrdsSchema } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

const appPackage = odbPackage('pck_app', (p) => {
  p.procedure('version', (proc) => {
    proc.out('version', 'VARCHAR2')
    proc.out('test', 'CLOB')
    proc.body((body) => {
      // Option B: typed handle \u2014 methods are type-aware (only CLOB has .toBase64/.toBlob)
      const vVersion = body.variable('v_version', 'VARCHAR2', 200).assign("'1.0.1'")
      body.assign('version', 'v_version')

      // Option A: pure function returning a PL/SQL expression string
      body.assign('test', odbLob.varchar2ToBase64(vVersion.name))
    })
    proc.ords()
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
