#!/usr/bin/env node

import { Command } from 'commander';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import chalk from 'chalk';
import { homedir, platform, tmpdir } from 'os';
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

const tryExec = (command: string, cwd?: string): boolean => {
  try {
    execSync(command, {
      cwd,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
};

const getPodmanCommand = (): string | null => {
  const isWindows = platform() === 'win32';
  if (isWindows) {
    if (tryExec('podman.exe --version')) {
      return 'podman.exe';
    }
  }

  if (tryExec('podman --version')) {
    return 'podman';
  }

  return null;
};

const ensureFileFromExample = (targetPath: string, examplePath: string) => {
  if (existsSync(targetPath)) {
    return;
  }

  if (!existsSync(examplePath)) {
    throw new Error(`Missing example file: ${examplePath}`);
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(examplePath, targetPath);
};

const normalizePathForSqlcl = (p: string): string => {
  // SQLcl generally tolerates forward slashes on Windows.
  return p.replace(/\\/g, '/');
};

const pickQQuoteDelimiter = (value: string): string => {
  const candidates = ['~', '^', '!', '#', '%', '|', '+', '='];
  const delimiter = candidates.find((c) => !value.includes(c));
  if (!delimiter) {
    throw new Error('Unable to pick a safe q-quote delimiter for config JSON.');
  }
  return delimiter;
};

type TnsAlias = {
  name: string;
};

const parseTnsnamesAliases = (tnsNamesContent: string): TnsAlias[] => {
  const aliases: TnsAlias[] = [];
  const lines = tnsNamesContent.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = trimmed.match(/^([A-Za-z0-9_\-\.]+)\s*=/);
    if (match) {
      aliases.push({ name: match[1] });
    }
  }
  return aliases;
};

const detectPreferredTnsAlias = (tnsNamesContent: string): string | null => {
  const aliases = parseTnsnamesAliases(tnsNamesContent);
  if (aliases.length === 0) {
    return null;
  }

  const tp = aliases.find((a) => a.name.toLowerCase().endsWith('_tp'));
  return (tp ?? aliases[0]).name;
};

const expandZipToDirectory = (zipPath: string, destinationDir: string) => {
  mkdirSync(destinationDir, { recursive: true });
  const isWindows = platform() === 'win32';
  if (isWindows) {
    const zip = zipPath.replace(/"/g, '""');
    const dest = destinationDir.replace(/"/g, '""');
    execSync(
      `powershell.exe -NoProfile -Command "Expand-Archive -Force -Path \"${zip}\" -DestinationPath \"${dest}\""`,
      { stdio: 'inherit' },
    );
    return;
  }

  execSync(`unzip -o -q "${zipPath}" -d "${destinationDir}"`, { stdio: 'inherit' });
};

const downloadWalletZipFromContainer = async (
  podmanCmd: string,
  containerName: string,
  outputZipPath: string,
): Promise<void> => {
  mkdirSync(path.dirname(outputZipPath), { recursive: true });

  const zipCommand = [
    "set -euo pipefail",
    'cd /u01/app/oracle/wallets/tls_wallet',
    'shopt -s dotglob',
    'zip -r -X -q - *',
  ].join(' && ');

  await new Promise<void>((resolve, reject) => {
    const child = spawn(podmanCmd, ['exec', containerName, 'bash', '-lc', zipCommand], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const output = createWriteStream(outputZipPath);
    child.stdout?.pipe(output);

    let stderr = '';
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => reject(error));
    child.on('exit', (code) => {
      output.close();
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || `podman exec exited with code ${code}`));
      }
    });
  });
};

// Wait for container to be healthy with progress feedback
const waitForContainerHealth = async (
  podmanCmd: string,
  containerName: string,
  timeoutMs: number = 600000, // 10 minutes default
  intervalMs: number = 5000, // 5 seconds between checks
): Promise<void> => {
  const startTime = Date.now();
  const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let frameIndex = 0;

  const getContainerStatus = (): string | null => {
    try {
      const result = execSync(
        `${podmanCmd} inspect --format "{{.State.Health.Status}}" ${containerName}`,
        { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
      ).trim();
      return result;
    } catch {
      // Container might not exist yet or no health check defined
      try {
        const running = execSync(
          `${podmanCmd} inspect --format "{{.State.Running}}" ${containerName}`,
          { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] },
        ).trim();
        return running === 'true' ? 'running' : 'not-running';
      } catch {
        return null;
      }
    }
  };

  return new Promise((resolve, reject) => {
    const check = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed > timeoutMs) {
        process.stdout.write('\n');
        reject(new Error(`Timeout waiting for container ${containerName} to be healthy`));
        return;
      }

      const status = getContainerStatus();
      const elapsedMin = Math.floor(elapsed / 60000);
      const elapsedSec = Math.floor((elapsed % 60000) / 1000);
      const timeStr = elapsedMin > 0 ? `${elapsedMin}m ${elapsedSec}s` : `${elapsedSec}s`;

      if (status === 'healthy') {
        process.stdout.write('\r' + ' '.repeat(80) + '\r'); // Clear line
        resolve();
        return;
      }

      const spinner = spinnerFrames[frameIndex % spinnerFrames.length];
      frameIndex++;
      const statusDisplay = status ?? 'waiting';
      process.stdout.write(`\r${chalk.blue(spinner)} Waiting for database to be ready... (${statusDisplay}, ${timeStr})`);

      setTimeout(check, intervalMs);
    };

    check();
  });
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

// Local DB command group
const localDbCmd = program.command('local-db').description('Local database (ADB Free) helpers using Podman');

localDbCmd
  .command('up')
  .description('Build and start the local database container (podman compose up -d --build)')
  .option('-d, --dir <dir>', 'Local DB folder (defaults to i13e/local/db)')
  .action((options: { dir?: string }) => {
    const podmanCmd = getPodmanCommand();
    if (!podmanCmd) {
      logger.error('Podman not found. Please install Podman and ensure it is on PATH.');
      process.exit(1);
    }

    const localDbDir = options.dir
      ? path.resolve(rootDir, options.dir)
      : path.resolve(rootDir, 'i13e/local/db');
    if (!existsSync(localDbDir)) {
      logger.error(`Local DB folder not found: ${localDbDir}`);
      process.exit(1);
    }

    logger.info('Starting local DB (podman compose up)...');
    execSync(`${podmanCmd} compose up -d --build`, { cwd: localDbDir, stdio: 'inherit' });
    logger.success('Local DB started');
  });

localDbCmd
  .command('down')
  .description('Stop and remove the local database container (podman compose down)')
  .option('-d, --dir <dir>', 'Local DB folder (defaults to i13e/local/db)')
  .action((options: { dir?: string }) => {
    const podmanCmd = getPodmanCommand();
    if (!podmanCmd) {
      logger.error('Podman not found. Please install Podman and ensure it is on PATH.');
      process.exit(1);
    }

    const localDbDir = options.dir
      ? path.resolve(rootDir, options.dir)
      : path.resolve(rootDir, 'i13e/local/db');
    if (!existsSync(localDbDir)) {
      logger.error(`Local DB folder not found: ${localDbDir}`);
      process.exit(1);
    }

    logger.info('Stopping local DB (podman compose down)...');
    execSync(`${podmanCmd} compose down`, { cwd: localDbDir, stdio: 'inherit' });
    logger.success('Local DB stopped');
  });

localDbCmd
  .command('logs')
  .description('Show recent logs from the local database container')
  .option('-n, --name <name>', 'Container name', 'odbvue-db-dev')
  .option('-t, --tail <lines>', 'Tail lines', '80')
  .action((options: { name: string; tail: string }) => {
    const podmanCmd = getPodmanCommand();
    if (!podmanCmd) {
      logger.error('Podman not found. Please install Podman and ensure it is on PATH.');
      process.exit(1);
    }

    execSync(`${podmanCmd} logs --tail ${options.tail} ${options.name}`, { stdio: 'inherit' });
  });

localDbCmd
  .command('wallet')
  .description('Download the TLS wallet from the local DB container to a zip file')
  .option('-n, --name <name>', 'Container name', 'odbvue-db-dev')
  .option('-o, --out <path>', 'Output zip path (defaults to ~/.wallets/odbvue/local.zip)')
  .action(async (options: { name: string; out?: string }) => {
    const podmanCmd = getPodmanCommand();
    if (!podmanCmd) {
      logger.error('Podman not found. Please install Podman and ensure it is on PATH.');
      process.exit(1);
    }

    const defaultOut = path.resolve(homedir(), '.wallets/odbvue/local.zip');
    const outPath = options.out ? path.resolve(rootDir, options.out) : defaultOut;

    logger.info(`Downloading wallet to: ${outPath}`);
    try {
      await downloadWalletZipFromContainer(podmanCmd, options.name, outPath);
      logger.success('Wallet downloaded');
    } catch (error) {
      logger.error(`Failed to download wallet: ${error}`);
      process.exit(1);
    }
  });

// Guided local setup
program
  .command('local-setup')
  .description('Guided local setup: start local DB, create config files, and prepare app/wiki for local dev')
  .action(async () => {
    const podmanCmd = getPodmanCommand();
    if (!podmanCmd) {
      logger.error('Podman not found. Install Podman first (or run manual setup from i13e/local/db).');
      process.exit(1);
    }

    const hasSqlcl = tryExec('sql -v');
    if (!hasSqlcl) {
      logger.warn('SQLcl (sql) not found on PATH. You can still start DB, but installs/exports will not work.');
    }

    const appsDir = path.resolve(rootDir, 'apps');
    const dbDir = path.resolve(rootDir, 'db');
    const localDbDir = path.resolve(rootDir, 'i13e/local/db');
    const cliEnvPath = path.resolve(rootDir, 'cli/.env');

    if (!existsSync(localDbDir)) {
      logger.error(`Local DB folder not found: ${localDbDir}`);
      process.exit(1);
    }

    logger.info('Configuring local DB...');
    const defaultContainerName = 'odbvue-db-dev';
    const containerNameInput = await prompt(`Container name [${defaultContainerName}]: `);
    const containerName = containerNameInput.trim() ? containerNameInput.trim() : defaultContainerName;

    const defaultPassword = 'MySecurePass123!';
    const adminPasswordInput = await prompt(`ADMIN_PASSWORD [${defaultPassword}]: `);
    const walletPasswordInput = await prompt(`WALLET_PASSWORD [${defaultPassword}]: `);
    const adminPassword = adminPasswordInput.trim() ? adminPasswordInput.trim() : defaultPassword;
    const walletPassword = walletPasswordInput.trim() ? walletPasswordInput.trim() : defaultPassword;

    const localDbEnvPath = path.resolve(localDbDir, '.env');
    const localDbEnvExamplePath = path.resolve(localDbDir, '.env.example');
    if (!existsSync(localDbEnvPath)) {
      ensureFileFromExample(localDbEnvPath, localDbEnvExamplePath);
    }
    writeFileSync(
      localDbEnvPath,
      `CONTAINER_NAME="${containerName}"\nADMIN_PASSWORD="${adminPassword}"\nWALLET_PASSWORD="${walletPassword}"\n`,
      'utf-8',
    );
    logger.success('Local DB .env written');

    logger.info('Starting local DB container...');
    execSync(`${podmanCmd} compose up -d --build`, { cwd: localDbDir, stdio: 'inherit' });
    logger.success('Local DB container started');

    logger.info('Waiting for database to be healthy (this may take 3-5 minutes)...');
    try {
      await waitForContainerHealth(podmanCmd, containerName);
      logger.success('Database is healthy');
    } catch (error) {
      logger.error(`${error}`);
      logger.warn('You can manually wait and then run: ov local-wallet --name ' + containerName);
      process.exit(1);
    }

    const walletZipPath = path.resolve(homedir(), '.wallets/odbvue/local.zip');
    logger.info('Downloading wallet from container...');
    await downloadWalletZipFromContainer(podmanCmd, containerName, walletZipPath);
    logger.success(`Wallet saved: ${walletZipPath}`);

    const walletExtractDir = path.resolve(tmpdir(), `odbvue-wallet-${Date.now()}`);
    logger.info('Detecting TNS alias from wallet...');
    expandZipToDirectory(walletZipPath, walletExtractDir);
    const tnsNamesPath = path.resolve(walletExtractDir, 'tnsnames.ora');
    if (!existsSync(tnsNamesPath)) {
      logger.error('Could not find tnsnames.ora in extracted wallet.');
      process.exit(1);
    }

    const tnsNames = readFileSync(tnsNamesPath, 'utf-8');
    const detectedAlias = detectPreferredTnsAlias(tnsNames);
    if (!detectedAlias) {
      logger.error('Could not detect a TNS alias from tnsnames.ora.');
      process.exit(1);
    }
    logger.success(`Using TNS alias: ${detectedAlias}`);

    const sqlclWallet = normalizePathForSqlcl(walletZipPath);
    const odbvueConn = `-cloudconfig ${sqlclWallet} admin/${adminPassword}@${detectedAlias}`;
    writeFileSync(cliEnvPath, `ODBVUE_DB_CONN="${odbvueConn}"\n`, 'utf-8');
    logger.success('Wrote cli/.env (ODBVUE_DB_CONN)');

    // Create db/.config.json from example if missing
    const dbConfigPath = path.resolve(dbDir, '.config.json');
    const dbConfigExamplePath = path.resolve(dbDir, '.config.json.example');
    if (!existsSync(dbConfigPath)) {
      ensureFileFromExample(dbConfigPath, dbConfigExamplePath);
      try {
        const configRaw = readFileSync(dbConfigPath, 'utf-8');
        const config = JSON.parse(configRaw) as {
          schema?: { username?: string; password?: string };
          app?: { password?: string; host?: string };
          smtp?: { password?: string };
          jwt?: { secret?: string };
        };

        if (config.schema) {
          config.schema.password = adminPassword;
          config.schema.username = config.schema.username ?? 'odbvue';
        }
        if (config.app) {
          config.app.password = adminPassword;
          config.app.host = 'localhost:5173';
        }
        if (config.smtp) {
          config.smtp.password = adminPassword;
        }
        if (config.jwt) {
          config.jwt.secret = adminPassword;
        }

        writeFileSync(dbConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
        logger.success('Wrote db/.config.json');
      } catch {
        logger.warn('db/.config.json created but could not be auto-filled.');
      }
    } else {
      logger.info('db/.config.json already exists; leaving it unchanged.');
    }

    // Create apps/.env.local
    const appsEnvLocalPath = path.resolve(appsDir, '.env.local');
    if (!existsSync(appsEnvLocalPath)) {
      writeFileSync(
        appsEnvLocalPath,
        `VITE_API_URI=https://localhost:8443/ords/odbvue/\n`,
        'utf-8',
      );
      logger.success('Wrote apps/.env.local');
    }

    logger.success('Local setup completed');
    console.log('');
    logger.info('Next steps:');
    console.log(chalk.gray('  1) Install DB schema + objects: ') + chalk.cyan('ov db-install-local'));
    console.log(chalk.gray('  2) Start app + wiki dev servers: ') + chalk.cyan('ov dev'));
  });

// Install database objects into the local DB
program
  .command('db-install-local')
  .alias('dil')
  .description('Install/upgrade schema + objects into the local DB using db/dist and db/.config.json')
  .option('-c, --connection <connection>', 'Database connection (uses ODBVUE_DB_CONN if not provided)')
  .option('-v, --version <version>', 'Version tag (defaults to apps/package.json version)')
  .action((options: { connection?: string; version?: string }) => {
    const connection = options.connection || process.env.ODBVUE_DB_CONN;
    if (!connection) {
      logger.error('Database connection not provided and ODBVUE_DB_CONN not set (try: ov local-setup).');
      process.exit(1);
    }

    const dbDir = path.resolve(rootDir, 'db');
    const dbDistDir = path.resolve(dbDir, 'dist');
    const dbConfigPath = path.resolve(dbDir, '.config.json');
    if (!existsSync(dbConfigPath)) {
      logger.error('Missing db/.config.json. Create it from db/.config.json.example (or run ov local-setup).');
      process.exit(1);
    }

    const configJson = JSON.parse(readFileSync(dbConfigPath, 'utf-8')) as unknown;
    const configCompact = JSON.stringify(configJson);
    const delimiter = pickQQuoteDelimiter(configCompact);

    const appsPackagePath = path.resolve(rootDir, 'apps/package.json');
    const appsPackage = JSON.parse(readFileSync(appsPackagePath, 'utf-8')) as { version: string };
    const versionTag = options.version ? options.version : `v${appsPackage.version}`;
    const schemaName = 'odbvue';
    const edition = `${schemaName}_${versionTag.replace(/[.\-]/g, '_')}`.toUpperCase();

    logger.info(`Installing to schema '${schemaName}', edition '${edition}', version '${versionTag}'...`);

    const sqlScript = [
      `connect ${connection}`,
      'set define off',
      'set verify off',
      'set feedback off',
      'set serveroutput on',
      'set sqlblanklines on',
      'variable config CLOB',
      'variable schema VARCHAR2(200)',
      'variable edition VARCHAR2(200)',
      `begin :config := q'${delimiter}${configCompact}${delimiter}'; :schema := '${schemaName}'; :edition := '${edition}'; end;`,
      '/',
      'set define on',
      `define EDITION = '${edition}'`,
      '@000_install.sql',
      "lb update -log -changelog-file releases/main.changelog.xml -search-path '.'",
      '@999_install.sql',
      `prompt Installed ${versionTag} (${edition})`,
      'exit',
      '',
    ].join('\n');

    const tempScriptPath = path.resolve(dbDistDir, '.sql_install_local_temp');
    writeFileSync(tempScriptPath, sqlScript, 'utf-8');

    try {
      const isWindows = platform() === 'win32';
      const shell = isWindows ? 'powershell.exe' : '/bin/bash';
      const sqlclCommand = `sql /nolog "@${tempScriptPath}"`;

      execSync(sqlclCommand, {
        cwd: dbDistDir,
        stdio: 'inherit',
        shell,
      });

      logger.success('Database install completed');
    } catch (error) {
      logger.error(`Database install failed: ${error}`);
      process.exit(1);
    } finally {
      try {
        unlinkSync(tempScriptPath);
      } catch {
        // ignore
      }
    }
  });

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
            const sqlclCommand = `sql /nolog "@${tempScriptPath}"`;

            execSync(sqlclCommand, {
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

// Database Scaffold - Generate SQL from module API definitions
program
  .command('db-scaffold [path]')
  .alias('ds')
  .description('Generate SQL scripts from module API definitions (scans current directory if no path provided)')
  .option('-o, --output <dir>', 'Output directory (defaults to ./dist relative to module)')
  .action(async (pathArg: string | undefined, options: { output?: string }) => {
    try {
      const cwd = process.cwd();
      let apiPath: string;

      if (!pathArg) {
        // Default: look for index.ts in current directory
        apiPath = path.resolve(cwd, 'index.ts');
      } else {
        // Path provided: look for api/index.ts relative to that path
        const targetDir = path.isAbsolute(pathArg) ? pathArg : path.resolve(cwd, pathArg);
        apiPath = path.resolve(targetDir, 'api/index.ts');
      }

      if (!existsSync(apiPath)) {
        logger.error(`API file not found: ${apiPath}`);
        process.exit(1);
      }

      await scaffoldModule(apiPath, options.output);
    } catch (error) {
      logger.error(`Failed to scaffold: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    async function scaffoldModule(apiPath: string, outputDir?: string): Promise<void> {
      const moduleName = path.basename(path.dirname(path.dirname(apiPath)));
      const apiDir = path.dirname(apiPath);
      const distDir = outputDir || path.resolve(apiDir, 'dist');

      // Create dist directory if it doesn't exist
      mkdirSync(distDir, { recursive: true });

      try {
        // Create a temporary loader script
        const fileUrl = `file://${path.resolve(apiDir, 'index.ts').replace(/\\/g, '/')}`
        const loaderScript = `import('${fileUrl}').then(m => {
  const schema = m.schema;
  const tables = m.tables || [];
  const packages = m.packages || [];
  const sqlParts = [];
  
  if (schema && typeof schema.render === 'function') {
    sqlParts.push(schema.render());
  }
  
  for (const table of tables) {
    if (typeof table.render === 'function') {
      sqlParts.push(table.render());
    }
  }
  
  for (const pkg of packages) {
    if (typeof pkg.render === 'function') {
      sqlParts.push(pkg.render());
    }
  }
  
  console.log(JSON.stringify({ sqlParts, tableCount: tables.length, packageCount: packages.length }));
}).catch(err => {
  console.error(JSON.stringify({ error: err.message }));
  process.exit(1);
});`;

        const loaderPath = path.resolve(tmpdir(), `ov-scaffold-${Date.now()}.mjs`);
        writeFileSync(loaderPath, loaderScript, 'utf-8');

        try {
          const result = execSync(`npx tsx ${loaderPath}`, {
            cwd: rootDir,
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'pipe'],
          });

          const jsonMatch = result.match(/\{.*\}/s);
          if (!jsonMatch) {
            throw new Error('No JSON output found from loader script');
          }

          const output = JSON.parse(jsonMatch[0]);
          
          if (output.error) {
            throw new Error(output.error);
          }

          const { sqlParts, tableCount, packageCount } = output;

          if (tableCount === 0 && packageCount === 0) {
            logger.warn(`No tables or packages exported from ${moduleName}`);
            return;
          }

          if (sqlParts.length > 0) {
            const sqlContent = sqlParts.join('\n\n');
            const outputPath = path.resolve(distDir, 'index.sql');
            writeFileSync(outputPath, sqlContent, 'utf-8');
            logger.success(
              `Scaffolded @odbvue/${moduleName} → ${path.relative(rootDir, outputPath)} (${tableCount} tables, ${packageCount} packages)`
            );

            // Prompt user to execute
            const answer = await prompt('\nWould you like to execute this script? (y/n) ');
            
            if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
              const connection = process.env.ODBVUE_DB_CONN;
              if (!connection) {
                logger.error('Database connection not set. Set ODBVUE_DB_CONN environment variable.');
                return;
              }

              logger.info(`Executing with connection: ${connection}...`);

              try {
                const sqlScript = `connect ${connection}\n@${outputPath}\nexit\n`;
                const tempScriptPath = path.resolve(distDir, '.sql_temp');
                writeFileSync(tempScriptPath, sqlScript);

                try {
                  const isWindows = platform() === 'win32';
                  const shell = isWindows ? 'powershell.exe' : '/bin/bash';
                  const sqlclCommand = `sql /nolog "@${tempScriptPath}"`;

                  execSync(sqlclCommand, {
                    cwd: distDir,
                    stdio: 'inherit',
                    shell,
                  });

                  logger.success(`Script executed successfully.`);
                } finally {
                  // Clean up temporary file
                  try {
                    unlinkSync(tempScriptPath);
                  } catch {
                    // Ignore cleanup errors
                  }
                }
              } catch (error) {
                logger.error(`Script execution failed: ${error}`);
              }
            }
          }
        } finally {
          // Clean up temp file
          try {
            unlinkSync(loaderPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error) {
        throw new Error(`Failed to process ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no command provided
if (process.argv.length < 3) {
  program.outputHelp();
}
