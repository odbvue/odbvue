import { defineMigration, odbAuth, odbEnv, odbHttp, odbRateLimit, odbSchema } from '@odbvue/odb'

const schemaName = odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME')
const schemaPassword = odbEnv.read('ODBVUE_ADB_SCHEMA_PASSWORD')

export const schema = odbSchema(schemaName, schemaPassword, (definition) => {
  definition.grant('EXECUTE ON DBMS_CRYPTO')
})

export const migration = defineMigration('00000000000000_bootstrap', {
  schema: schemaName,
})
  .install(odbHttp)
  .install(odbRateLimit)
  .install(odbAuth)
  .install(
    odbAuth.seedUser({
      username: 'admin',
      password: odbEnv.read('ODBVUE_AUTH_INITIAL_PASSWORD', 'ChangeMe123!'),
      displayName: 'Administrator',
    }),
  )
