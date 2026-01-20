import { Command } from 'commander';
import { logger, chalk, rootDir, path, existsSync, readFileSync, writeFileSync, mkdirSync } from '../utils.js';
import YAML from 'js-yaml';
import prompts from 'prompts';

export const configCreateAction = async () => {
  logger.info(chalk.bold('Create New Environment Configuration'));
  logger.msg('');

  const configDir = path.resolve(rootDir, 'config');
  const configYamlPath = path.resolve(configDir, 'config.yaml');
  const envExamplePath = path.resolve(configDir, '.env.example');

  // Check if config directory exists
  if (!existsSync(configDir)) {
    logger.error(`Config directory not found: ${configDir}`);
    process.exit(1);
  }

  // Check if .env.example exists
  if (!existsSync(envExamplePath)) {
    logger.error(`Example env file not found: ${envExamplePath}`);
    process.exit(1);
  }

  // Read current config to get defaults
  let currentConfig: { project?: string; environment?: string } = {
    project: 'odbvue',
    environment: 'dev',
  };
  if (existsSync(configYamlPath)) {
    const configContent = readFileSync(configYamlPath, 'utf-8');
    currentConfig = (YAML.load(configContent) as typeof currentConfig) || currentConfig;
  }

  const response = await prompts([
    {
      type: 'text',
      name: 'project',
      message: 'Project name',
      initial: currentConfig.project || 'odbvue',
    },
    {
      type: 'text',
      name: 'environment',
      message: 'Environment name',
      validate: (value) => (value.trim() ? true : 'Environment name is required'),
    },
  ]);

  // Handle cancellation
  if (!response.project || !response.environment) {
    logger.warn('Setup cancelled.');
    return;
  }

  const { project, environment } = response as {
    project: string;
    environment: string;
  };

  // Check if environment already exists
  const envDir = path.resolve(configDir, environment);
  if (existsSync(envDir)) {
    logger.error(`Environment "${environment}" already exists at: ${envDir}`);
    process.exit(1);
  }

  // Create environment directory
  mkdirSync(envDir, { recursive: true });
  logger.success(`Created environment directory: ${envDir}`);

  // Copy .env.example to new environment as .env
  const envExampleContent = readFileSync(envExamplePath, 'utf-8');

  // Replace default container name with project-db-environment pattern
  const containerName = `${project}-db-${environment}`;
  let envContent = envExampleContent.replace(
    /DB_CONTAINER_NAME="[^"]*"/,
    `DB_CONTAINER_NAME="${containerName}"`,
  );

  // Update wallet path to match new container name
  envContent = envContent.replace(
    /DB_WALLET_PATH="[^"]*"/,
    `DB_WALLET_PATH="./.wallets/${containerName}.zip"`,
  );

  const envPath = path.resolve(envDir, '.env');
  writeFileSync(envPath, envContent, 'utf-8');
  logger.success(`Created .env file: ${envPath}`);

  // Create .wallets directory
  const walletsDir = path.resolve(envDir, '.wallets');
  mkdirSync(walletsDir, { recursive: true });
  logger.success(`Created wallets directory: ${walletsDir}`);

  // Update config.yaml with new environment
  const updatedConfig = {
    project,
    environment,
  };
  const updatedConfigContent = YAML.dump(updatedConfig);
  writeFileSync(configYamlPath, updatedConfigContent, 'utf-8');
  logger.success(`Updated config.yaml with new environment`);

  // Final success message
  logger.msg('');
  logger.success('Environment configuration created successfully!');
  logger.msg('');
  logger.muted(`Environment: ${environment}`);
  logger.muted(`Config path: ${envDir}`);
  logger.msg('');

};

export const registerConfigCreateCommand = (program: Command) => {
  program
    .command('config-create')
    .alias('cc')
    .description('Create a new environment configuration')
    .action(configCreateAction);
};
