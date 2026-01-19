import { Command } from 'commander';
import {
  logger,
  prompt,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
} from '../utils.js';

export const registerSubmitPrCommand = (program: Command) => {
  program
    .command('submit-pr')
    .alias('sp')
    .description('Submit PR with database changes and changeset')
    .option('-c, --connection <connection>', 'Database connection (uses ODBVUE_DB_CONN if not provided)')
    .action(async (options: { connection?: string }) => {
      try {
        // Check for uncommitted changes
        const status = execSync('git status --porcelain', {
          cwd: rootDir,
          encoding: 'utf-8',
        }).trim();

        if (status) {
          logger.error('You have uncommitted changes. Please commit or stash them first.');
          process.exit(1);
        }

        const connection = options.connection || process.env.ODBVUE_DB_CONN;

        if (!connection) {
          logger.error('Database connection not provided and ODBVUE_DB_CONN environment variable not set.');
          logger.info('Usage: ov submit-pr [-c, --connection <connection>]');
          logger.info('Set ODBVUE_DB_CONN in your .env file or provide -c option');
          process.exit(1);
        }

        logger.info(`Staging database changes with connection: ${connection}...`);

        const dbDir = path.resolve(rootDir, 'db');
        const sqlScript = `connect ${connection}\nproject stage\nexit\n`;

        try {
          // Create a temporary file with the SQL script for cross-platform compatibility
          const tempScriptPath = path.resolve(dbDir, '.sql_submit_temp');
          writeFileSync(tempScriptPath, sqlScript);

          try {
            const isWindows = platform() === 'win32';
            const shell = isWindows ? 'powershell.exe' : '/bin/bash';
            const sqlclCommand = `sql /nolog "@${tempScriptPath}"`;

            execSync(sqlclCommand, {
              cwd: dbDir,
              stdio: 'inherit',
              shell,
            });
          } finally {
            // Clean up temporary file
            try {
              unlinkSync(tempScriptPath);
            } catch {
              // Ignore cleanup errors
            }
          }
        } catch (error) {
          logger.error(`Database project stage failed: ${error}`);
          process.exit(1);
        }

        logger.warn('Please check if staged database content is OK');
        const confirmStage = await prompt('Continue? (Y/N): ');

        if (confirmStage.toLowerCase() !== 'y') {
          logger.info('Aborted by user.');
          process.exit(1);
        }

        logger.info('Staging database changes...');
        execSync('git add db/', { cwd: rootDir, stdio: 'inherit' });

        const appsDir = path.resolve(rootDir, 'apps');

        logger.info('Creating changeset...');
        execSync('pnpm changeset', { cwd: appsDir, stdio: 'inherit' });

        logger.info('Committing changes...');
        execSync('git add .', { cwd: rootDir, stdio: 'inherit' });

        // Get the latest changeset file to extract summary
        let commitMessage = 'changeset: Update version';

        try {
          const changesetFiles = execSync('ls -t .changeset/*.md 2>/dev/null | head -1', {
            cwd: appsDir,
            encoding: 'utf-8',
            shell: '/bin/bash',
          })
            .trim()
            .split('\n')
            .filter((f: string) => f);

          if (changesetFiles.length > 0) {
            const latestFile = path.resolve(appsDir, changesetFiles[0]);
            if (existsSync(latestFile)) {
              const content = readFileSync(latestFile, 'utf-8');
              const lines = content.split('\n').filter((line: string) => line.trim());
              if (lines.length > 0) {
                commitMessage = `changeset: ${lines[lines.length - 1]}`;
              }
            }
          }
        } catch {
          // Use default message if extraction fails
        }

        execSync(`git commit -m "${commitMessage}"`, { cwd: rootDir, stdio: 'inherit' });

        logger.info('Pushing changes...');
        const branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: rootDir,
          encoding: 'utf-8',
        }).trim();

        execSync(`git push -u origin ${branch}`, { cwd: rootDir, stdio: 'inherit' });

        logger.success(`Pushed to origin/${branch}`);
        logger.success('PR submission completed successfully!');
      } catch (error) {
        logger.error(`Failed to submit PR: ${error}`);
        process.exit(1);
      }
    });
};
