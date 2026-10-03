import { runDbMigrate } from './db-migrate.js'

export const runDbUp = async (target?: string): Promise<void> => {
  await runDbMigrate('up', target)
}
