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
  unlinkSync,
  writeFileSync,
} from 'fs';
import chalk from 'chalk';
import { homedir, platform } from 'os';
import YAML from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get root directory (parent of cli folder)
export const rootDir = path.resolve(__dirname, '../../');
export const cliDir = path.resolve(__dirname, '../');

/**
 * Get the default environment from config/config.yaml
 * Falls back to 'dev' if config.yaml doesn't exist or environment is not set
 */
export const getDefaultEnvironment = (): string => {
  const configYamlPath = path.join(rootDir, 'config', 'config.yaml');
  if (!existsSync(configYamlPath)) {
    return 'dev';
  }
  try {
    const configContent = readFileSync(configYamlPath, 'utf-8');
    const config = YAML.load(configContent) as { environment?: string };
    return config.environment || 'dev';
  } catch {
    return 'dev';
  }
};

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
  msg: (msg: string) => console.log(msg),
  muted: (msg: string) => console.log(chalk.gray(msg)),
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

// Re-export commonly used modules for convenience
export { chalk, path, existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync, homedir, platform, execSync, spawn };
