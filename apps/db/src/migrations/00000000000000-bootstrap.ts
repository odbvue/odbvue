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
} from '@odbvue/odb'

const schemaName = odbEnv.adb.schemaUsername
const schemaPassword = odbEnv.adb.schemaPassword

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
  .install(
    odbAuth.seedUser({
      username: 'admin@odbvue.com',
      password: odbEnv.read('ODBVUE_AUTH_INITIAL_PASSWORD', 'MySecurePass123!'),
      displayName: 'Administrator',
    }),
  )
