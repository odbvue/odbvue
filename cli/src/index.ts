#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import chalk from 'chalk';
import { platform } from 'os';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get root directory (parent of cli folder)
const rootDir = path.resolve(__dirname, '../../');
const cliDir = path.resolve(__dirname, '../');

// Load environment variables from .env files
const loadEnvFile = (envPath: string) => {
  if (!existsSync(envPath)) {
    return;
  }

  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^\s*([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    });
  } catch (error) {
    // Ignore errors reading .env files
  }
};

// Load .env from cli directory first, then root directory
loadEnvFile(path.resolve(cliDir, '.env'));
loadEnvFile(path.resolve(rootDir, '.env'));

// Read version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Logger utility
const logger = {
  success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`ℹ ${msg}`)),
  warn: (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`)),
};

// Prompt utility for user input
const prompt = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};

const program = new Command();

program
  .name('ov')
  .description('OdbVue CLI - Project management utilities')
  .version(version, '-v, --version');

// New Feature command
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

// Close Feature command
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

// DB Export command
program
  .command('db-export')
  .alias('de')
  .description('Export database objects and commit changes')
  .option('-c, --connection <connection>', 'Database connection (uses ODBVUE_DB_CONN if not provided)')
  .action(async (options) => {
    try {
      const connection = options.connection || process.env.ODBVUE_DB_CONN;

      if (!connection) {
        logger.error('Database connection not provided and ODBVUE_DB_CONN environment variable not set.');
        logger.info('Usage: ov db-export [-c, --connection <connection>]');
        process.exit(1);
      }

      logger.info(`Exporting database objects with connection: ${connection}...`);

      const dbDir = path.resolve(rootDir, 'db');
      const sqlScript = `connect ${connection}\nproject export\nexit\n`;

      try {
        // Create a temporary file with the SQL script for cross-platform compatibility
        const tempScriptPath = path.resolve(dbDir, '.sql_export_temp');
        writeFileSync(tempScriptPath, sqlScript);

        try {
          const isWindows = platform() === 'win32';
          const shell = isWindows ? 'powershell.exe' : '/bin/bash';
          const piping = isWindows
            ? `type "${tempScriptPath}" | sql /nolog`
            : `cat "${tempScriptPath}" | sql /nolog`;

          execSync(piping, {
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
        logger.error(`Database export failed: ${error}`);
        process.exit(1);
      }

      logger.warn('Please verify if DB objects are correctly exported');

      const commitResponse = await prompt('Would you like to commit changes? (Y/N): ');

      if (commitResponse.toLowerCase() !== 'y') {
        logger.info('Export completed without committing changes.');
        return;
      }

      const commitMessage = await prompt('Enter commit message: ');

      if (!commitMessage.trim()) {
        logger.error('Commit message cannot be empty.');
        process.exit(1);
      }

      logger.info('Committing changes...');

      execSync('git add .', { cwd: dbDir, stdio: 'inherit' });
      execSync(`git commit -m "feat(db): ${commitMessage}"`, { cwd: dbDir, stdio: 'inherit' });

      logger.success('Database export completed and changes committed.');
    } catch (error) {
      logger.error(`Failed to export database: ${error}`);
      process.exit(1);
    }
  });

// DB Add Custom command
program
  .command('db-add-custom <file>')
  .alias('da')
  .description('Stage custom database file')
  .action((file: string) => {
    try {
      logger.info(`Staging custom database file: ${file}...`);

      const dbDir = path.resolve(rootDir, 'db');
      const sqlScript = `project stage add-custom -file-name ${file}\nexit\n`;

      try {
        // Create a temporary file with the SQL script for cross-platform compatibility
        const tempScriptPath = path.resolve(dbDir, '.sql_custom_temp');
        writeFileSync(tempScriptPath, sqlScript);

        try {
          const isWindows = platform() === 'win32';
          const shell = isWindows ? 'powershell.exe' : '/bin/bash';
          const piping = isWindows
            ? `type "${tempScriptPath}" | sql /nolog`
            : `cat "${tempScriptPath}" | sql /nolog`;

          execSync(piping, {
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
        logger.error(`Database custom file staging failed: ${error}`);
        process.exit(1);
      }

      logger.success(`Custom database file '${file}' staged successfully.`);
    } catch (error) {
      logger.error(`Failed to stage custom database file: ${error}`);
      process.exit(1);
    }
  });

// Submit PR command
program
  .command('submit-pr')
  .alias('sp')
  .description('Submit PR with database changes and changeset')
  .option('-c, --connection <connection>', 'Database connection (uses ODBVUE_DB_CONN if not provided)')
  .action(async (options) => {
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
          const piping = isWindows
            ? `type "${tempScriptPath}" | sql /nolog`
            : `cat "${tempScriptPath}" | sql /nolog`;

          execSync(piping, {
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
      const changesetDir = path.resolve(appsDir, '.changeset');
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

// Create Release command
program
  .command('create-release')
  .alias('cr')
  .description('Create and publish release')
  .option('-m, --message <message>', 'Additional release message')
  .action((options) => {
    try {
      logger.info('Preparing release...');
      execSync('git checkout main', { cwd: rootDir, stdio: 'inherit' });
      execSync('git pull origin main', { cwd: rootDir, stdio: 'inherit' });

      // Read version from apps/package.json
      const packageJsonPath = path.resolve(rootDir, 'apps/package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const versionNoV = packageJson.version;
      const version = `v${versionNoV}`;

      // Database project release
      const dbDir = path.resolve(rootDir, 'db');
      if (existsSync(dbDir)) {
        logger.info(`Creating database release for version ${version}...`);
        const sqlScript = `project release -version "${version}"\nexit\n`;

        try {
          const tempScriptPath = path.resolve(dbDir, '.sql_release_temp');
          writeFileSync(tempScriptPath, sqlScript);

          try {
            const isWindows = platform() === 'win32';
            const shell = isWindows ? 'powershell.exe' : '/bin/bash';
            const piping = isWindows
              ? `type "${tempScriptPath}" | sql /nolog`
              : `cat "${tempScriptPath}" | sql /nolog`;

            execSync(piping, {
              cwd: dbDir,
              stdio: 'inherit',
              shell,
            });
          } finally {
            try {
              unlinkSync(tempScriptPath);
            } catch {
              // Ignore cleanup errors
            }
          }
        } catch (error) {
          logger.error(`Database release failed: ${error}`);
          process.exit(1);
        }
      }

      logger.info('Committing release...');
      execSync('git add .', { cwd: rootDir, stdio: 'inherit' });

      const message = options.message ? ` ${options.message}` : '';
      const commitMessage = `release: ${version}${message}`;
      execSync(`git commit -m "${commitMessage}"`, { cwd: rootDir, stdio: 'inherit' });

      logger.info('Creating and pushing tag...');
      const tagMessage = `Release ${version}${message}`;
      execSync(`git tag -a "${version}" -m "${tagMessage}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync(`git push origin "${version}"`, { cwd: rootDir, stdio: 'inherit' });
      execSync('git push', { cwd: rootDir, stdio: 'inherit' });

      logger.success(`Release ${version} published successfully`);
    } catch (error) {
      logger.error(`Failed to create release: ${error}`);
      process.exit(1);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
