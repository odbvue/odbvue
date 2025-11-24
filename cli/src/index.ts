#!/usr/bin/env node

import { Command } from 'commander';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const program = new Command();

// Get root directory (parent of cli folder)
const rootDir = path.resolve(__dirname, '../../');

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

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
