import { Command } from 'commander';
import {
  logger,
  rootDir,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  execSync,
  platform,
} from '../utils.js';

export const registerCreateReleaseCommand = (program: Command) => {
  program
    .command('create-release')
    .alias('cr')
    .description('Create and publish release')
    .option('-m, --message <message>', 'Additional release message')
    .action((options: { message?: string }) => {
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
};
