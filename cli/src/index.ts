#!/usr/bin/env node

import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
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

      logger.success('Database export completed');
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

// Dev command - Run all development servers
program
  .command('dev')
  .description('Start all development servers (app, wiki) in parallel')
  .option('--no-wiki', 'Skip running wiki dev server')
  .option('-a, --all', 'Show all output from all processes simultaneously')
  .action((options) => {
    const appsDir = path.resolve(rootDir, 'apps');

    interface ProcessData {
      name: string;
      command: string;
      args: string[];
      process?: ReturnType<typeof spawn>;
      output: string[];
      status: 'starting' | 'running' | 'error';
      url?: string;
      port?: number;
      errorMessage?: string;
    }

    const processesData: ProcessData[] = [];
    let currentPage = 0; // 0 = summary, 1+ = process output
    let isShuttingDown = false;

    const spawnProcess = (processData: ProcessData) => {
      logger.info(`Starting ${processData.name}...`);
      processData.status = 'starting';

      const child = spawn(processData.command, processData.args, {
        cwd: appsDir,
        stdio: options.all ? 'inherit' : ['ignore', 'pipe', 'pipe'],
        shell: true,
      });

      processData.process = child;

      if (!options.all) {
        const handleData = (data: Buffer) => {
          const text = data.toString();
          processData.output.push(text);

          // Keep only last 100 lines to avoid memory issues
          if (processData.output.length > 100) {
            processData.output.shift();
          }

          // Extract URL from output if found
          if (text.includes('Local') && text.includes('http://localhost:')) {
            
            processData.url = 'http://localhost:' + text.split(':')[3].trim();
          }

          // Detect when service is running with multiple indicators
          if (processData.status === 'starting') {
            const lowerText = text.toLowerCase();
            
            // More specific indicators for each service
            let isRunning = lowerText.includes('local:') || 
                         lowerText.includes('http://localhost');

            if (isRunning) {
              processData.status = 'running';
            }

            // Check for actual errors to set error status
            if (lowerText.includes('error')) {
              processData.status = 'error';
            }
          }
        };

        child.stdout?.on('data', handleData);
        child.stderr?.on('data', handleData);

        child.on('error', (error) => {
          processData.status = 'error';
          processData.errorMessage = error.message;
          processData.output.push(chalk.red(`ERROR: ${error.message}`));
        });
      }

      child.on('exit', (code) => {
        if (code !== 0 && code !== null && !isShuttingDown) {
          processData.status = 'error';
          processData.errorMessage = `Exited with code ${code}`;
        }
      });
    };

    const displaySummary = () => {
      console.clear();
      console.log(chalk.cyan(`\n  OdbVue Development Environment Dashboard\n`));
      console.log(`  ─────────────────────────────────────────────\n`);

      console.log(chalk.bold(`  Services:\n`));

      processesData.forEach((proc, index) => {
        const statusIcon =
          proc.status === 'running'
            ? chalk.green('●')
            : proc.status === 'error'
              ? chalk.red('●')
              : chalk.yellow('●');
        const statusText =
          proc.status === 'running'
            ? chalk.green('RUNNING')
            : proc.status === 'error'
              ? chalk.red('ERROR')
              : chalk.yellow('STARTING');

        console.log(`  ${statusIcon} [${index + 2}] ${proc.name.padEnd(15)} ${statusText}`);

        if (proc.url) {
          console.log(chalk.gray(`     └─ `) + chalk.blue.underline(proc.url));
        }

        if (proc.status === 'error' && proc.errorMessage) {
          console.log(chalk.red(`     └─ Error: ${proc.errorMessage}`));
        }

        console.log();
      });

      console.log(`  ─────────────────────────────────────────────`);
      console.log(chalk.gray(`  [1] Summary (this page)`));
      processesData.forEach((_, index) => {
        console.log(chalk.gray(`  [${index + 2}] ${processesData[index].name} output`));
      });
      console.log(chalk.gray(`  [q] Quit\n`));
    };

    const displayProcessOutput = (processIndex: number) => {
      if (processIndex < 0 || processIndex >= processesData.length) {
        return;
      }
  
      console.clear();
  
      const proc = processesData[processIndex];
      console.log(`\n  ${proc.name}`);

      const statusIcon =
        proc.status === 'running'
          ? chalk.green('●')
          : proc.status === 'error'
            ? chalk.red('●')
            : chalk.yellow('●');
      const statusText =
        proc.status === 'running'
          ? chalk.green('RUNNING')
          : proc.status === 'error'
            ? chalk.red('ERROR')
            : chalk.yellow('STARTING');

      console.log(`  Status: ${statusIcon} ${statusText}\n`);
      console.log(`  ─────────────────────────────────────────────\n`);

      if (proc.output.length === 0) {
        console.log(chalk.gray('  (waiting for output...)\n'));
      } else {
        const lastLines = proc.output.slice(-30).join('');
        console.log(lastLines);
      }

      console.log(`\n  ─────────────────────────────────────────────`);
      console.log(chalk.gray(`  [1] Summary | [2-4] Other processes | [q] Quit\n`));
    };

    try {
      // Initialize processes
      processesData.push({
        name: 'App Dev',
        command: 'pnpm',
        args: ['dev'],
        output: [],
        status: 'starting',
        url: 'http://localhost:5173',
      });

      if (options.wiki) {
        processesData.push({
          name: 'Wiki Dev',
          command: 'pnpm',
          args: ['wiki:dev'],
          output: [],
          status: 'starting',
          url: 'http://localhost:5174',
        });
      }

      // Start all processes
      processesData.forEach((p) => spawnProcess(p));

      logger.success(
        `Development environment started with ${processesData.length} process(es).`,
      );

      if (!options.all) {
        // Set up interactive keyboard controls
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
          process.stdin.setEncoding('utf-8');

          process.stdin.on('data', (key: string) => {
            if (key === 'q' || key === 'Q') {
              shutdown();
            } else if (key >= '1' && key <= '9') {
              const pageNum = parseInt(key, 10);
              if (pageNum === 1) {
                currentPage = 0;
                displaySummary();
              } else if (pageNum - 2 < processesData.length) {
                currentPage = pageNum - 1;
                displayProcessOutput(pageNum - 2);
              }
            }
          });

          displaySummary();

          // Refresh display every 1000ms
          setInterval(() => {
            if (currentPage === 0) {
              displaySummary();
            } else {
              displayProcessOutput(currentPage - 1);
            }
          }, 1000);
        }
      }

      // Handle graceful shutdown
      const shutdown = () => {
        isShuttingDown = true;

        if (process.stdin.isTTY) {
          process.stdin.setRawMode(false);
        }

        logger.info('Shutting down processes...');
        const killPromises = processesData.map(
          ({ name, process: proc }) =>
            new Promise<void>((resolve) => {
              if (proc && !proc.killed) {
                logger.info(`Stopping ${name}...`);
                proc.kill('SIGTERM');
                
                const killTimeout = setTimeout(() => {
                  if (proc && !proc.killed) {
                    logger.warn(`Force killing ${name}...`);
                    proc.kill('SIGKILL');
                  }
                  resolve();
                }, 5000);

                proc.on('exit', () => {
                  clearTimeout(killTimeout);
                  resolve();
                });
              } else {
                resolve();
              }
            }),
        );

        Promise.all(killPromises).then(() => {
          logger.success('All processes stopped');
          process.exit(0);
        });
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      logger.error(`Failed to start development environment: ${error}`);
      processesData.forEach(({ process: proc }) => {
        if (proc && !proc.killed) {
          proc.kill();
        }
      });
      process.exit(1);
    }
  });

// Commit All command
program
  .command('commit-all')
  .alias('ca')
  .description('Add and commit all changes with scope and message')
  .action(async () => {
    try {
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

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
