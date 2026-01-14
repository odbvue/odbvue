import chalk from 'chalk'
import prompts from 'prompts'
import { logger } from './index.js'

export async function handleCommitAll() {
  const { execSync } = await import('child_process')

  const rootDir = process.cwd()

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
        description: 'Changes to build process, dependencies, or tools',
      },
    ]

    const typeResponse = await prompts({
      type: 'select',
      name: 'type',
      message: 'Select commit type',
      choices: commitTypes,
      initial: 0,
    })

    const type = typeResponse.type

    const scopeResponse = await prompts({
      type: 'text',
      name: 'scope',
      message: 'Enter scope (e.g., apps, db, i13e, cicd, wiki, chore) - leave empty for none',
    })

    const scope = scopeResponse.scope?.trim() || ''

    const messageResponse = await prompts({
      type: 'text',
      name: 'message',
      message: 'Enter commit message',
    })

    const message = messageResponse.message?.trim()

    if (!type) {
      logger.error('No commit type selected')
      process.exit(1)
    }

    if (!message) {
      logger.error('Commit message is required')
      process.exit(1)
    }

    logger.info('Staging all changes...')
    execSync('git add .', { cwd: rootDir, stdio: 'inherit' })

    const commitMessage = scope ? `${type}(${scope}): ${message}` : `${type}: ${message}`

    logger.info('Committing changes...')
    execSync(`git commit -m "${commitMessage}"`, {
      cwd: rootDir,
      stdio: 'inherit',
    })

    logger.success(`Committed: ${chalk.cyan(commitMessage)}`)
  } catch (error) {
    logger.error(
      `Failed to commit changes: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exit(1)
  }
}
