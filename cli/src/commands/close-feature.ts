import { Command } from 'commander';
import { logger, rootDir, execSync } from '../utils.js';

export const registerCloseFeatureCommand = (program: Command) => {
  program
    .command('close-feature')
    .alias('cf')
    .description('Close feature branch with squash merge to main')
    .action(() => {
      try {
        const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: rootDir,
          encoding: 'utf-8',
        }).trim();

        if (currentBranch === 'main') {
          logger.error('Already on main branch');
          process.exit(1);
        }

        logger.info(`Closing feature branch: ${currentBranch}...`);
        execSync('git checkout main', { cwd: rootDir, stdio: 'inherit' });
        execSync('git pull origin main', { cwd: rootDir, stdio: 'inherit' });
        execSync(`git merge --squash ${currentBranch}`, { cwd: rootDir, stdio: 'inherit' });
        execSync('git push', { cwd: rootDir, stdio: 'inherit' });
        execSync(`git branch -d ${currentBranch}`, { cwd: rootDir, stdio: 'inherit' });
        execSync(`git push origin --delete ${currentBranch}`, { cwd: rootDir, stdio: 'inherit' });
        logger.success('Feature closed');
      } catch (error) {
        logger.error(`Failed to close feature: ${error}`);
        process.exit(1);
      }
    });
};
