import { Command } from 'commander'
import { runImplode } from '../app/implode.js'

export const registerImplodeCommand = (program: Command) => {
  program
    .command('implode')
    .description('Remove project setup')
    .action(async () => {
      await runImplode()
    })
}
