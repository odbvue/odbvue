import { Command } from 'commander';
import {
  logger,
  pickQQuoteDelimiter,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
} from '../utils.js';

export const registerDbInstallLocalCommand = (program: Command) => {
  program
    .command('db-install-local')
    .alias('dil')
    .description('Install/upgrade schema + objects into the local DB using db/dist and db/.config.json')
    .option('-c, --connection <connection>', 'Database connection (uses ODBVUE_DB_CONN if not provided)')
    .option('-t, --tns-admin <path>', 'TNS_ADMIN directory path (uses ODBVUE_TNS_ADMIN if not provided)')
    .option('-v, --version <version>', 'Version tag (defaults to apps/package.json version)')
    .action((options: { connection?: string; tnsAdmin?: string; version?: string }) => {
      const connection = options.connection || process.env.ODBVUE_DB_CONN;
      if (!connection) {
        logger.error('Database connection not provided and ODBVUE_DB_CONN not set (try: ov local-setup).');
        process.exit(1);
      }

      const tnsAdmin = options.tnsAdmin || process.env.ODBVUE_TNS_ADMIN;

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

        // Pass TNS_ADMIN environment variable if set
        const env = { ...process.env };
        if (tnsAdmin) {
          env.TNS_ADMIN = tnsAdmin;
        }

        execSync(sqlclCommand, {
          cwd: dbDistDir,
          stdio: 'inherit',
          shell,
          env,
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
};
