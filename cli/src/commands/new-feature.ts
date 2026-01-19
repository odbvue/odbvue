import { Command } from 'commander';
import { logger, rootDir, execSync } from '../utils.js';

export const registerNewFeatureCommand = (program: Command) => {
  program
    .command('new-feature <name>')
    .alias('nf')
    .description('Create a new feature branch (feat/<name>)')
    .action((name: string) => {
      try {
        // Check for unmerged changes
        const status = execSync('git status --porcelain', {
          cwd: rootDir,
          encoding: 'utf-8',
        }).trim();

        if (status) {
          logger.error('You have unmerged changes. Please commit or stash them before proceeding.');
          process.exit(1);
        }

        logger.info(`Creating feature branch: feat/${name}...`);
        execSync('git checkout main', { cwd: rootDir, stdio: 'inherit' });
        execSync('git pull origin main', { cwd: rootDir, stdio: 'inherit' });
        execSync(`git checkout -b feat/${name}`, { cwd: rootDir, stdio: 'inherit' });
        logger.success(`Feature branch 'feat/${name}' created and checked out.`);
      } catch (error) {
        logger.error(`Failed to create feature branch: ${error}`);
        process.exit(1);
      }
    });
};
