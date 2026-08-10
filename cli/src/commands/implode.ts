import { Command } from 'commander'
import { runImplode } from '../app/implode.js'

export const registerImplodeCommand = (program: Command) => {
  program
    .command('implode')
    .description('Remove project setup')
    .option('--destroy-db', 'remove the database schema before local resources')
    .action(async (options: { destroyDb?: boolean }) => {
      await runImplode({ destroyDb: options.destroyDb })
    })
}
