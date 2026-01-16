import prompts from 'prompts'
import { logger, rootDir } from '../index.js'

export async function handleCommitAll() {
  const { execSync } = await import('child_process')

  try {
    logger.info('Running pnpm format...')
    try {
      execSync('pnpm format', { cwd: rootDir, stdio: 'inherit' })
      logger.success('Format completed')
    } catch {
      logger.error('Format failed')
      process.exit(1)
    }

    logger.info('Running pnpm lint...')
    try {
      execSync('pnpm lint', { cwd: rootDir, stdio: 'inherit' })
      logger.success('Lint completed')
    } catch {
      logger.error('Lint failed. Please fix lint errors before committing')
      process.exit(1)
    }

    logger.info('Running pnpm type-check...')
    try {
      execSync('pnpm type-check', { cwd: rootDir, stdio: 'inherit' })
      logger.success('Type-check completed')
    } catch {
      logger.error('Type-check failed. Please fix type errors before committing')
      process.exit(1)
    }

    // Conventional commit types
    const commitTypes = [
      { title: 'feat', value: 'feat', description: 'A new feature' },
      { title: 'fix', value: 'fix', description: 'A bug fix' },
      { title: 'docs', value: 'docs', description: 'Documentation only changes' },
      {
        title: 'test',
        value: 'test',
        description: 'Adding missing tests or correcting existing tests',
      },
      {
        title: 'chore',
        value: 'chore',
        description: 'Other changes that do not modify src or test files',
      },
      { title: 'style', value: 'style', description: 'Changes that do not affect code meaning' },
      {
        title: 'refactor',
        value: 'refactor',
        description: 'A code change that neither fixes a bug nor adds a feature',
      },
      {
        title: 'perf',
        value: 'perf',
        description: 'A code change that improves performance',
      },
      {
        title: 'ci',
        value: 'ci',
        description: 'Changes to CI configuration files and scripts',
      },
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
        message: 'Commit scope (e.g., cli, db, apps)',
        validate: (value) => (value.trim() ? true : 'Scope cannot be empty'),
      },
      {
        type: 'text',
        name: 'message',
        message: 'Commit message (imperative mood)',
        validate: (value) => (value.trim() ? true : 'Message cannot be empty'),
      },
    ])

    const { type, scope, message } = response
    const commitMessage = `${type}(${scope}): ${message}`

    logger.info('Staging changes...')
    execSync('git add .', { cwd: rootDir, stdio: 'inherit' })

    logger.info('Creating commit...')
    execSync(`git commit -m "${commitMessage}"`, { cwd: rootDir, stdio: 'inherit' })
    logger.success('Commit created successfully')
  } catch (error) {
    logger.error('Error during commit process')
    console.error(error)
    process.exit(1)
  }
}
