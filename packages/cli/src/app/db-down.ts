import { runDbMigrate } from './db-migrate.js'

export const runDbDown = async (target?: string): Promise<void> => {
  await runDbMigrate('down', target)
}
