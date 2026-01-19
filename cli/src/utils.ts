import { execSync, spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import chalk from 'chalk';
import { homedir, platform } from 'os';
import { createInterface } from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get root directory (parent of cli folder)
export const rootDir = path.resolve(__dirname, '../../');
export const cliDir = path.resolve(__dirname, '../');

// Load environment variables from .env files
export const loadEnvFile = (envPath: string) => {
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
  } catch {
    // Ignore errors reading .env files
  }
};

// Logger utility
export const logger = {
  success: (msg: string) => console.log(chalk.green(`✓ ${msg}`)),
  error: (msg: string) => console.error(chalk.red(`✗ ${msg}`)),
  info: (msg: string) => console.log(chalk.blue(`ℹ ${msg}`)),
  warn: (msg: string) => console.warn(chalk.yellow(`⚠ ${msg}`)),
};

export const tryExec = (command: string, cwd?: string): boolean => {
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

export const getPodmanCommand = (): string | null => {
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

export const ensureFileFromExample = (targetPath: string, examplePath: string) => {
  if (existsSync(targetPath)) {
    return;
  }

  if (!existsSync(examplePath)) {
    throw new Error(`Missing example file: ${examplePath}`);
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(examplePath, targetPath);
};

export const normalizePathForSqlcl = (p: string): string => {
  // SQLcl generally tolerates forward slashes on Windows.
  return p.replace(/\\/g, '/');
};

export const pickQQuoteDelimiter = (value: string): string => {
  const candidates = ['~', '^', '!', '#', '%', '|', '+', '='];
  const delimiter = candidates.find((c) => !value.includes(c));
  if (!delimiter) {
    throw new Error('Unable to pick a safe q-quote delimiter for config JSON.');
  }
  return delimiter;
};

export type TnsAlias = {
  name: string;
};

export const parseTnsnamesAliases = (tnsNamesContent: string): TnsAlias[] => {
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

export const detectPreferredTnsAlias = (tnsNamesContent: string): string | null => {
  const aliases = parseTnsnamesAliases(tnsNamesContent);
  if (aliases.length === 0) {
    return null;
  }

  const tp = aliases.find((a) => a.name.toLowerCase().endsWith('_tp'));
  return (tp ?? aliases[0]).name;
};

export const expandZipToDirectory = (zipPath: string, destinationDir: string) => {
  mkdirSync(destinationDir, { recursive: true });
  const isWindows = platform() === 'win32';
  if (isWindows) {
    const zip = zipPath.replace(/"/g, '""');
    const dest = destinationDir.replace(/"/g, '""');
    execSync(
      `powershell.exe -NoProfile -Command "Expand-Archive -Force -Path \\"${zip}\\" -DestinationPath \\"${dest}\\""`,
      { stdio: 'inherit' },
    );
    return;
  }

  execSync(`unzip -o -q "${zipPath}" -d "${destinationDir}"`, { stdio: 'inherit' });
};

export const downloadWalletZipFromContainer = async (
  podmanCmd: string,
  containerName: string,
  outputZipPath: string,
): Promise<void> => {
  mkdirSync(path.dirname(outputZipPath), { recursive: true });

  const zipCommand = [
    'set -euo pipefail',
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
export const waitForContainerHealth = async (
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
      process.stdout.write(
        `\r${chalk.blue(spinner)} Waiting for database to be ready... (${statusDisplay}, ${timeStr})`,
      );

      setTimeout(check, intervalMs);
    };

    check();
  });
};

// Prompt utility for user input
export const prompt = (question: string): Promise<string> => {
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

// Re-export commonly used modules for convenience
export { chalk, path, existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, homedir, platform, execSync, spawn };
