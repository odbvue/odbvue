import { defineMigration, odbLiteral, odbPackage } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

const testPackage = odbPackage('pck_test', (pkg) => {
  pkg.proc('test', (proc) => {
    const result = proc.out('R_RESULT', 'VARCHAR2')
    proc.body((body) => body.set(result, odbLiteral('OK')))
    proc.service({ method: 'GET', path: '/test' })
  })
})

export const migration = defineMigration('20260810182241_test_2', {
  schema: schemaName,
  tag: '1.0.1',
}).install(testPackage)
