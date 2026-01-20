import { Command } from 'commander'
import prompts from 'prompts'
import { logger, rootDir, path, execSync } from '../utils.js'

export const registerCommitAllCommand = (program: Command) => {
  program
    .command('commit-all')
    .alias('ca')
    .description('Add and commit all changes with scope and message')
    .action(async () => {
      try {
        const appsDir = path.resolve(rootDir, 'apps')

        // Run format
        logger.info('Running pnpm format...')
        execSync('pnpm format', { cwd: appsDir, stdio: 'inherit' })
        logger.success('Format completed.')

        // Run lint
        logger.info('Running pnpm lint...')
        try {
          execSync('pnpm lint', { cwd: appsDir, stdio: 'inherit' })
          logger.success('Lint completed.')
        } catch {
          logger.error('Lint failed. Please fix lint errors before committing.')
          process.exit(1)
        }

        // Run type-check
        logger.info('Running pnpm type-check...')
        try {
          execSync('pnpm type-check', { cwd: appsDir, stdio: 'inherit' })
          logger.success('Type-check completed.')
        } catch {
          logger.error('Type-check failed. Please fix type errors before committing.')
          process.exit(1)
        }

        const commitTypes = [
          { title: 'feat', value: 'feat', description: 'A new feature' },
          { title: 'fix', value: 'fix', description: 'A bug fix' },
          { title: 'chore', value: 'chore', description: 'Other changes' },
        ]

        const response = await prompts([
          {
            type: 'select',
            name: 'type',
            message: 'Select commit type',
            choices: commitTypes,
            initial: 0,
          },
          {
            type: 'text',
            name: 'scope',
            message: 'Commit scope (e.g., apps, db, cli, wiki)',
            validate: (value) => (value.trim() ? true : 'Scope cannot be empty'),
          },
          {
            type: 'text',
            name: 'message',
            message: 'Commit message (imperative mood)',
            validate: (value) => (value.trim() ? true : 'Message cannot be empty'),
          },
        ])

        if (!response.type || !response.scope || !response.message) {
          logger.error('Commit cancelled.')
          process.exit(1)
        }

        const fullMessage = `${response.type}(${response.scope.trim()}): ${response.message.trim()}`

        logger.info('Committing all changes...')
        execSync('git add .', { cwd: rootDir, stdio: 'inherit' })
        execSync(`git commit -m "${fullMessage}"`, {
          cwd: rootDir,
          stdio: 'inherit',
        })

        logger.success(`Changes committed with message: "${fullMessage}"`)
      } catch (error) {
        logger.error(`Failed to commit changes: ${error}`)
        process.exit(1)
      }
    })
}
