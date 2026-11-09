import {
  defineMigration,
  odbAcl,
  odbAudit,
  odbAuth,
  odbEmails,
  odbEnv,
  odbGoogle,
  odbHttp,
  odbLob,
  odbRateLimit,
  odbSchema,
  odbSettings,
  odbStorage,
} from '@odbvue/odb'

const schemaName = odbEnv.schemaUsername

export const schema = odbSchema(schemaName, odbEnv.schemaPassword, (definition) => {
  definition.grant('EXECUTE ON DBMS_CRYPTO')
  definition.grant('EXECUTE ON SYS.DBMS_LDAP')
  definition.grant('EXECUTE ON UTL_ENCODE')
  definition.grant('EXECUTE ON UTL_I18N')
  definition.grant('EXECUTE ON UTL_INADDR')
  definition.grant('EXECUTE ON UTL_TCP')
  definition.grant('EXECUTE ON UTL_SMTP')
  definition.grant('EXECUTE ON UTL_HTTP')
  definition.grant('EXECUTE ON UTL_URL')
  definition.grant('EXECUTE ON SYS.DBMS_NETWORK_ACL_ADMIN')
  definition.grant('SELECT ON SYS.DBA_HOST_ACES')
})

export const migration = defineMigration('00000000000000_bootstrap', {
  schema: schemaName,
})
  .install(odbHttp)
  .install(odbRateLimit)
  .install(odbAudit)
  .install(odbSettings)
  .install(odbLob)
  .install(odbStorage)
  .install(odbAuth)
  .install(odbAuth.seedSettings())
  .install(odbGoogle)
  .install(odbGoogle.seedSettings())
  .install(odbAuth.config({ twoFactor: process.env.NODE_ENV !== 'development' }))
  .install(odbAcl)
  .install(odbEmails)
  .install(
    odbSettings.seed(
      { id: 'SMTP_HOST', value: '', meta: { label: 'SMTP host', type: 'string' } },
      { id: 'SMTP_PORT', value: '', meta: { label: 'SMTP port', type: 'number' } },
      { id: 'SMTP_USERNAME', value: '', meta: { label: 'SMTP username', type: 'string' } },
      {
        id: 'SMTP_PASSWORD',
        value: '',
        meta: { label: 'SMTP password', type: 'string', secret: 'Y' },
      },
      { id: 'SMTP_FROM_ADDR', value: '', meta: { label: 'SMTP sender address', type: 'string' } },
      { id: 'SMTP_FROM_NAME', value: '', meta: { label: 'SMTP sender name', type: 'string' } },
    ),
  )
  .install(
    odbSettings.seed({
      id: 'APP_PUBLIC_URL',
      value: '',
      meta: { label: 'Public application URL for account emails', type: 'string' },
    }),
  )
  .install(
    odbSettings.seed({
      id: 'APP_SETTINGS_MASTER_KEY_URI',
      value: '',
      meta: { label: 'OCI Vault master key secret bundle URI', type: 'string' },
    }),
  )
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
