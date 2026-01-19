import { execSync, spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import path from 'path';
import { logger, chalk } from '../utils.js';

/**
 * Check if Podman is installed
 */
export const checkPodmanInstalled = (podmanCmd: string | null): boolean => {
  return podmanCmd !== null;
};

/**
 * Check if Podman daemon/machine is running
 */
export const checkPodmanRunning = (podmanCmd: string): boolean => {
  try {
    execSync(`${podmanCmd} info`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
};

/**
 * Start Podman machine
 */
export const startPodmanMachine = (podmanCmd: string): boolean => {
  try {
    logger.info('Starting Podman machine...');
    execSync(`${podmanCmd} machine start`, { stdio: 'inherit' });
    logger.success('Podman machine started');
    return true;
  } catch {
    logger.error('Failed to start Podman machine');
    return false;
  }
};

/**
 * Check Podman system resources and warn if below recommended
 */
export const checkPodmanResources = (podmanCmd: string): void => {
  try {
    const info = execSync(`${podmanCmd} system info --format json`, { stdio: 'pipe' }).toString();
    const systemInfo = JSON.parse(info);

    const cpus = systemInfo.host?.cpus || 0;
    const memoryBytes = systemInfo.host?.memFree || 0;
    const memoryGb = memoryBytes / (1024 * 1024 * 1024);

    if (cpus < 4 || memoryGb < 8) {
      logger.warn(
        `Podman resources below recommended: ${cpus} CPU(s), ${memoryGb.toFixed(2)} GB RAM`,
      );
      logger.warn('Recommended: 4 CPU(s) and 8 GB RAM');
    }
  } catch {
    // Silently fail if unable to check resources
  }
};

/**
 * Get list of all database containers (running and stopped)
 */
export const getDatabaseContainers = (podmanCmd: string): string[] => {
  try {
    const output = execSync(`${podmanCmd} ps -a --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output.split('\n').filter((name) => name);
  } catch {
    return [];
  }
};

/**
 * Get list of running database containers
 */
export const getRunningDatabaseContainers = (podmanCmd: string): string[] => {
  try {
    const output = execSync(`${podmanCmd} ps --format "{{.Names}}"`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return output.split('\n').filter((name) => name);
  } catch {
    return [];
  }
};

/**
 * Download wallet zip from container
 */
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

/**
 * Wait for container to be healthy with progress feedback
 */
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
