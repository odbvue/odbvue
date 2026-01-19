import { Command } from 'commander';
import {
  logger,
  getPodmanCommand,
  rootDir,
  path,
  existsSync,
  execSync,
  homedir,
} from '../utils.js';
import { downloadWalletZipFromContainer } from '../utils/podman.js';

export const registerLocalDbCommands = (program: Command) => {
  const localDbCmd = program
    .command('local-db')
    .description('Local database (ADB Free) helpers using Podman');

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
};
