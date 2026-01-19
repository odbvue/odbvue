import { Command } from 'commander';
import { logger, prompt, rootDir, path, execSync } from '../utils.js';

export const registerCommitAllCommand = (program: Command) => {
  program
    .command('commit-all')
    .alias('ca')
    .description('Add and commit all changes with scope and message')
    .action(async () => {
      try {
        const appsDir = path.resolve(rootDir, 'apps');

        // Run format
        logger.info('Running pnpm format...');
        execSync('pnpm format', { cwd: appsDir, stdio: 'inherit' });
        logger.success('Format completed.');

        // Run lint
        logger.info('Running pnpm lint...');
        try {
          execSync('pnpm lint', { cwd: appsDir, stdio: 'inherit' });
          logger.success('Lint completed.');
        } catch {
          logger.error('Lint failed. Please fix lint errors before committing.');
          process.exit(1);
        }

        // Run type-check
        logger.info('Running pnpm type-check...');
        try {
          execSync('pnpm type-check', { cwd: appsDir, stdio: 'inherit' });
          logger.success('Type-check completed.');
        } catch {
          logger.error('Type-check failed. Please fix type errors before committing.');
          process.exit(1);
        }

        const scope = await prompt('Enter scope (e.g., apps, db, i13e, cicd, wiki, chore): ');

        if (!scope.trim()) {
          logger.error('Scope cannot be empty.');
          process.exit(1);
        }

        const message = await prompt('Enter commit message: ');

        if (!message.trim()) {
          logger.error('Commit message cannot be empty.');
          process.exit(1);
        }

        logger.info('Committing all changes...');
        execSync('git add .', { cwd: rootDir, stdio: 'inherit' });
        execSync(`git commit -m "(${scope.trim()}): ${message.trim()}"`, {
          cwd: rootDir,
          stdio: 'inherit',
        });

        logger.success(`Changes committed with message: "(${scope.trim()}): ${message.trim()}"`);
      } catch (error) {
        logger.error(`Failed to commit changes: ${error}`);
        process.exit(1);
      }
    });
};
