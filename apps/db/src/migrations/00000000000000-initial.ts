import { odbSchema, odbTable, defineMigration } from '@odbvue/odb'

const schemaName = process.env.ODBVUE_ADB_SCHEMA_USERNAME
const schemaPassword = process.env.ODBVUE_ADB_SCHEMA_PASSWORD

if (!schemaName) {
  throw new Error('ODBVUE_ADB_SCHEMA_USERNAME environment variable is not set')
}

if (!schemaPassword) {
  throw new Error('ODBVUE_ADB_SCHEMA_PASSWORD environment variable is not set')
}

const appSchema = odbSchema(schemaName, schemaPassword, (s) => {
  s.grant('EXECUTE ON DBMS_CRYPTO')
})

const appMigrationsTable = odbTable('app_migrations', (t) => {
  t.timestamp('created').defaultCurrentTimestamp().notNull()
  t.string('name', 200).notNull()

  t.unique('uq_app_migrations_name', ['name'])
})

export const migration = defineMigration('00000000000000_initial', {
  schema: schemaName,
  version: '1.0.0',
})
  .install(appSchema)
  .install(appMigrationsTable)
