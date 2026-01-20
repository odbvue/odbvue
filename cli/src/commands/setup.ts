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
      ]);

      // Handle cancellation
      if (!response.projectName || !response.environment) {
        logger.warn('Setup cancelled.');
        return;
      }

      const { projectName, environment } = response;

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

      // Write config
      const yamlContent = yaml.dump(config, { indent: 2 });
      writeFileSync(configPath, yamlContent, 'utf-8');

      logger.success('Configuration saved to config/config.yaml');
      logger.msg('');

      // Run local database setup
      await setupLocalAction();
    });
};
