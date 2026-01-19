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

export const registerDbAddCustomCommand = (program: Command) => {
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
};
