import { Command } from 'commander';
import {
  logger,
  rootDir,
  path,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
} from '../utils.js';

export const registerDbExportCommand = (program: Command) => {
  program
    .command('db-export')
    .alias('de')
    .description('Export database objects and commit changes')
    .option('-c, --connection <connection>', 'Database connection (uses ODBVUE_DB_CONN if not provided)')
    .action(async (options: { connection?: string }) => {
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
};
