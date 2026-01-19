import { Command } from 'commander';
import {
  logger,
  rootDir,
  chalk,
  path,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from '../utils.js';
import yaml from 'js-yaml';
import prompts from 'prompts';
import { setupLocalAction } from './setup-local.js';
import { setupCloudAction } from './setup-cloud.js';

export const registerSetupCommand = (program: Command) => {
  program
    .command('setup')
    .description('Initial project setup: configure project name, environment, and database type')
    .action(async () => {
      logger.info(chalk.bold('OdbVue Setup'));
      logger.msg('');

      const response = await prompts([
        {
          type: 'text',
          name: 'projectName',
          message: 'Project name',
          initial: 'odbvue',
        },
        {
          type: 'text',
          name: 'environment',
          message: 'Environment',
          initial: 'dev',
        },
        {
          type: 'select',
          name: 'databaseType',
          message: 'Database type',
          choices: [
            { title: 'Local - Oracle Database (Podman container)', value: 'local' },
            { title: 'Cloud - Oracle Cloud Infrastructure (OCI)', value: 'cloud' },
          ],
          initial: 0,
        },
      ]);

      // Handle cancellation
      if (!response.projectName || !response.environment || !response.databaseType) {
        logger.warn('Setup cancelled.');
        return;
      }

      const { projectName, environment, databaseType } = response;

      // Save configuration to config.yaml
      const configDir = path.resolve(rootDir, 'config');
      const configPath = path.resolve(configDir, 'config.yaml');

      // Ensure config directory exists
      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }

      // Load existing config if present
      let config: Record<string, unknown> = {};
      if (existsSync(configPath)) {
        try {
          const existingContent = readFileSync(configPath, 'utf-8');
          config = (yaml.load(existingContent) as Record<string, unknown>) || {};
        } catch {
          logger.warn('Could not parse existing config.yaml, creating new one.');
        }
      }

      // Update config
      config.project = projectName;
      config.environment = environment;
      config.database = databaseType;

      // Write config
      const yamlContent = yaml.dump(config, { indent: 2 });
      writeFileSync(configPath, yamlContent, 'utf-8');

      logger.success('Configuration saved to config/config.yaml');
      logger.msg('');

      // Run the appropriate setup based on database type
      if (databaseType === 'local') {
        await setupLocalAction();
      } else {
        await setupCloudAction();
      }
    });
};
