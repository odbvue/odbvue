import { runDbMigrate } from './db-migrate.js'

export const runDbUp = async (): Promise<void> => {
  await runDbMigrate('up')
}
