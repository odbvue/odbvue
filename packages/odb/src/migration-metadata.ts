import { odbTable } from './schema/table.js'

export const ODB_MIGRATIONS_TABLE = 'odb_migrations'
export const ODB_MIGRATION_OBJECTS_TABLE = 'odb_migration_objects'

const odbMigrationsTable = odbTable(ODB_MIGRATIONS_TABLE, (table) => ({
  created: table.timestamp().defaultCurrentTimestamp().notNull(),
  migrationName: table.string(200).notNull(),
})).unique((columns) => [columns.migrationName])

const odbMigrationObjectsTable = odbTable(ODB_MIGRATION_OBJECTS_TABLE, (table) => ({
  objectName: table.string(200).notNull().primaryKey(),
  objectType: table.string(30).notNull(),
  activeColor: table.string(10).notNull(),
  migrationName: table.string(200),
  created: table.timestamp().defaultCurrentTimestamp().notNull(),
  updated: table.timestamp(),
}))

export const migrationMetadataSql = (schema: string): string[] => [
  odbMigrationsTable.toSQLUp({ schema }),
  odbMigrationObjectsTable.toSQLUp({ schema }),
]
