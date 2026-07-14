import { odbSchema, odbTable, odbEdition, defineMigration } from '@odbvue/odb'

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

const appEdition = new odbEdition('1.0.0', schemaName)

export const migration = defineMigration('00000000000000_initial', '1.0.0')
  .up(() => [
    appSchema.toSQLUp(),
    appMigrationsTable.toSQLUp({ schema: appSchema.username }),
    appEdition.create(),
    appEdition.grantUse(),
    appEdition.setDefault(),
  ])
  .down(() => [
    appSchema.toSQLDown(),
    appEdition.setDefaultBase(),
    appEdition.setBase(),
    appEdition.drop({ cascade: true }),
  ])
