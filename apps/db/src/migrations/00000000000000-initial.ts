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

export const appMigrationsTable = odbTable('app_migrations', (t) => {
  const columns = {
    created: t.timestamp('created').defaultCurrentTimestamp().notNull(),
    migrationName: t.string('name', 200).notNull(),
  }

  t.unique('uq_app_migrations_name', ['name'])

  return columns
})

const appMigrationsObjectsTable = odbTable('app_migrations_objects', (t) => {
  const columns = {
    object_name: t.string('object_name', 200).notNull().primaryKey(),
    object_type: t.string('object_type', 30).notNull(),
    active_color: t.string('active_color', 10).notNull(),
    migration_name: t.string('migration_name', 200),
    created: t.timestamp('created').defaultCurrentTimestamp().notNull(),
    updated: t.timestamp('updated'),
  }

  return columns
})

export const migration = defineMigration('00000000000000_initial', {
  schema: schemaName,
})
  .install(appSchema)
  .install(appMigrationsTable)
  .install(appMigrationsObjectsTable)
