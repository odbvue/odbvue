#!/usr/bin/env node

import { Command } from 'commander';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadEnvFile, rootDir, cliDir } from './utils.js';
import {
  registerDbInstallLocalCommand,
  registerNewFeatureCommand,
  registerCloseFeatureCommand,
  registerDbExportCommand,
  registerDbAddCustomCommand,
  registerSubmitPrCommand,
  registerCreateReleaseCommand,
  registerDevCommand,
  registerCommitAllCommand,
  registerDbScaffoldCommand,
  registerSetupCommand,
  registerSetupLocalCommand,
  registerSetupCloudCommand,
  registerDbRunCommand,
  registerDbImportCommand,
  registerDbDiffCommand,
  registerDbReleaseCommand,
  registerConfigEnvironmentCommand,
  registerConfigCreateCommand,
} from './commands/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from cli directory first, then root directory
loadEnvFile(path.resolve(cliDir, '.env'));
loadEnvFile(path.resolve(rootDir, '.env'));

// Read version from package.json
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

// Create program
const program = new Command();

program
  .name('ov')
  .description('OdbVue CLI')
  .version(version, '-v, --version');

// Register all commands
registerSetupCommand(program);
registerSetupLocalCommand(program);
registerSetupCloudCommand(program);
registerDbInstallLocalCommand(program);
registerNewFeatureCommand(program);
registerCloseFeatureCommand(program);
registerDbExportCommand(program);
registerDbAddCustomCommand(program);
registerSubmitPrCommand(program);
registerCreateReleaseCommand(program);
registerDevCommand(program);
registerCommitAllCommand(program);
registerDbScaffoldCommand(program);
registerDbRunCommand(program);
registerDbImportCommand(program);
registerDbDiffCommand(program);
registerDbReleaseCommand(program);
registerConfigEnvironmentCommand(program);
registerConfigCreateCommand(program);

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
