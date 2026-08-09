import { odbEnv, odbSchema, odbTable, defineMigration } from '@odbvue/odb'

const schemaName = odbEnv.read('ODBVUE_ADB_SCHEMA_USERNAME')
const schemaPassword = odbEnv.read('ODBVUE_ADB_SCHEMA_PASSWORD')

const appSchema = odbSchema(schemaName, schemaPassword, (s) => {
  s.grant('EXECUTE ON DBMS_CRYPTO')
})

export const appMigrationsTable = odbTable('app_migrations', (t) => ({
  created: t.timestamp().defaultCurrentTimestamp().notNull(),
  migrationName: t.string(200).notNull(),
})).unique((c) => [c.migrationName])

const appMigrationsObjectsTable = odbTable('app_migrations_objects', (t) => ({
  object_name: t.string(200).notNull().primaryKey(),
  object_type: t.string(30).notNull(),
  active_color: t.string(10).notNull(),
  migration_name: t.string(200),
  created: t.timestamp().defaultCurrentTimestamp().notNull(),
  updated: t.timestamp(),
}))

export const migration = defineMigration('00000000000000_initial', {
  schema: schemaName,
})
  .install(appSchema)
  .install(appMigrationsTable)
  .install(appMigrationsObjectsTable)
