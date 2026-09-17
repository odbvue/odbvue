import { defineMigration, defineService, odbPackage, odbType } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME ?? ''

const testPackage = odbPackage('pck_test', (pkg) => {
  const test = pkg.defineProcedure('test', { out: { result: odbType.string() } })
  test.body((body) => body.set(test.parameters.result, 'OK'))
  defineService(test, {
    method: 'GET',
    path: '/test',
    params: { response: { result: 'result' } },
  })
})

export const migration = defineMigration('20260810182241_test_2', {
  schema: schemaName,
  tag: '1.0.1',
}).install(testPackage)
