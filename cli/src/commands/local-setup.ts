import { Command } from 'commander';
import {
  logger,
  getPodmanCommand,
  tryExec,
  rootDir,
  downloadWalletZipFromContainer,
  waitForContainerHealth,
  expandZipToDirectory,
  detectPreferredTnsAlias,
  normalizePathForSqlcl,
  ensureFileFromExample,
  prompt,
  chalk,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  execSync,
  homedir,
} from '../utils.js';

export const registerLocalSetupCommand = (program: Command) => {
  program
    .command('local-setup')
    .description(
      'Guided local setup: start local DB, create config files, and prepare app/wiki for local dev',
    )
    .action(async () => {
      const podmanCmd = getPodmanCommand();
      if (!podmanCmd) {
        logger.error(
          'Podman not found. Install Podman first (or run manual setup from i13e/local/db).',
        );
        process.exit(1);
      }

      const hasSqlcl = tryExec('sql -v');
      if (!hasSqlcl) {
        logger.warn(
          'SQLcl (sql) not found on PATH. You can still start DB, but installs/exports will not work.',
        );
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
      const walletDir = path.resolve(homedir(), '.wallets/odbvue/local');
      logger.info('Downloading wallet from container...');
      await downloadWalletZipFromContainer(podmanCmd, containerName, walletZipPath);
      logger.success(`Wallet saved: ${walletZipPath}`);

      logger.info('Extracting wallet...');
      expandZipToDirectory(walletZipPath, walletDir);
      const tnsNamesPath = path.resolve(walletDir, 'tnsnames.ora');
      if (!existsSync(tnsNamesPath)) {
        logger.error('Could not find tnsnames.ora in extracted wallet.');
        process.exit(1);
      }
      logger.success(`Wallet extracted: ${walletDir}`);

      logger.info('Detecting TNS alias from wallet...');
      const tnsNames = readFileSync(tnsNamesPath, 'utf-8');
      const detectedAlias = detectPreferredTnsAlias(tnsNames);
      if (!detectedAlias) {
        logger.error('Could not detect a TNS alias from tnsnames.ora.');
        process.exit(1);
      }
      logger.success(`Using TNS alias: ${detectedAlias}`);

      // Store wallet directory and connection info separately
      const sqlclWalletDir = normalizePathForSqlcl(walletDir);
      const odbvueConn = `admin/${adminPassword}@${detectedAlias}`;
      const odbvueTnsAdmin = sqlclWalletDir;
      writeFileSync(
        cliEnvPath,
        `ODBVUE_DB_CONN="${odbvueConn}"\nODBVUE_TNS_ADMIN="${odbvueTnsAdmin}"\n`,
        'utf-8',
      );
      logger.success('Wrote cli/.env (ODBVUE_DB_CONN, ODBVUE_TNS_ADMIN)');

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
        writeFileSync(appsEnvLocalPath, `VITE_API_URI=https://localhost:8443/ords/odbvue/\n`, 'utf-8');
        logger.success('Wrote apps/.env.local');
      }

      logger.success('Local setup completed');
      console.log('');
      logger.info('Next steps:');
      console.log(chalk.gray('  1) Install DB schema + objects: ') + chalk.cyan('ov db-install-local'));
      console.log(chalk.gray('  2) Start app + wiki dev servers: ') + chalk.cyan('ov dev'));
    });
};
