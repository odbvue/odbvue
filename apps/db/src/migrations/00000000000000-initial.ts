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

const appMigrationsObjectsTable = odbTable('app_migrations_objects', (t) => {
  t.string('object_name', 200).notNull().primaryKey()
  t.string('object_type', 30).notNull()
  t.string('active_color', 10).notNull()
  t.string('migration_name', 200)
  t.timestamp('created').defaultCurrentTimestamp().notNull()
  t.timestamp('updated')
})

export const migration = defineMigration('00000000000000_initial', {
  schema: schemaName,
})
  .install(appSchema)
  .install(appMigrationsTable)
  .install(appMigrationsObjectsTable)
