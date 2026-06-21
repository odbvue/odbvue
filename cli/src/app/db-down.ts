import { runDbMigrate } from './db-migrate.js'

export const runDbDown = async (): Promise<void> => {
  await runDbMigrate('down')
}
