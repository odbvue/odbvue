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
  odbStorage,
} from '@odbvue/odb'

const schemaName = odbEnv.schemaUsername
const schemaPassword = odbEnv.schemaPassword

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
  .install(odbStorage)
  .install(
    odbSettings.seed({
      id: 'APP_VERSION',
      value: '1.0.0',
      meta: { label: 'Application version', type: 'string' },
    }),
  )
  .install(
    odbAuth.seedUser({
      username: odbEnv.appUsername,
      password: odbEnv.appPassword,
      displayName: 'Administrator',
    }),
  )
  .install(odbAuth.role.seed({ name: 'admin', description: 'Application administrator' }))
  .install(odbAuth.role.seedGrant({ username: odbEnv.appUsername, role: 'admin' }))
