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

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
