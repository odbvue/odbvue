#!/usr/bin/env tsx

import { ConfigFileAuthenticationDetailsProvider, database, common } from 'oci-sdk';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

interface Args {
  configFile?: string;
  profile?: string;
  quiet?: boolean;
  yamlFile?: string;
  action?: 'plan' | 'apply' | 'destroy';
}

interface ATPConfig {
  compartment_id: string;
  db_name: string;
  display_name?: string;
  admin_password: string;
  cpu_core_count?: number;
  data_storage_size_in_tbs?: number;
  db_workload?: 'OLTP' | 'DW' | 'AJD' | 'APEX';
  is_free_tier?: boolean;
  is_auto_scaling_enabled?: boolean;
  license_model?: 'LICENSE_INCLUDED' | 'BRING_YOUR_OWN_LICENSE';
  whitelisted_ips?: string[];
}

interface DeploymentPlan {
  action: string;
  config: ATPConfig;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  estimated_resources: {
    autonomous_database: {
      id?: string;
      name: string;
      cpu_cores: number;
      storage_tb: number;
      workload_type: string;
      free_tier: boolean;
    };
  };
}

// Parse command line arguments
function parseArgs(): Args {
    const args: Args = {};
    const argv = process.argv.slice(2);

    for (let i = 0; i < argv.length; i++) {
        switch (argv[i]) {
            case '-c':
            case '--config':
                args.configFile = argv[++i];
                break;
            case '-p':
            case '--profile':
                args.profile = argv[++i];
                break;
            case '-q':
            case '--quiet':
                args.quiet = true;
                break;
            case '-f':
            case '--file':
                args.yamlFile = argv[++i];
                break;
            case '-a':
            case '--action':
                const action = argv[++i];
                if (!['plan', 'apply', 'destroy'].includes(action)) {
                    console.error('❌ Invalid action. Must be one of: plan, apply, destroy');
                    process.exit(1);
                }
                args.action = action as 'plan' | 'apply' | 'destroy';
                break;
            case '-h':
            case '--help':
                console.log('Usage: tsx deploy-atp.ts [-c config-file] [-p profile] [-q] [-f yaml-file] [-a action]');
                console.log('  -c, --config     Path to OCI config file');
                console.log('  -p, --profile    Profile name to use');
                console.log('  -q, --quiet      Quiet mode - only show results');
                console.log('  -f, --file       Path to YAML file with ATP configuration');
                console.log('  -a, --action     Action to perform: plan, apply, destroy');
                console.log('');
                console.log('Features:');
                console.log('  • After successful apply, displays connection URLs for easy browser access');
                console.log('  • Shows native OCI connection URLs: APEX, SQL Developer Web, Database Actions, etc.');
                console.log('  • Supports both new deployments and updates to existing ATP instances');
                process.exit(0);
                break;
        }
    }
    return args;
}

// Get configuration from arguments or use defaults
const args = parseArgs();
const configurationFilePath = args.configFile || join(homedir(), '.oci', 'config');
const profile = args.profile || 'DEFAULT';
const isQuiet = args.quiet || false;
const yamlFile = args.yamlFile || join(__dirname, '..', 'templates', 'atp.yaml');
const action = args.action || 'plan';

// Helper function for conditional logging
function log(message: string) {
    if (!isQuiet) {
        console.log(message);
    }
}

// Helper function for conditional warnings
function warn(message: string) {
    if (!isQuiet) {
        console.warn(message);
    }
}

// Helper function to format YAML output
function formatYaml(obj: any, indent: number = 0): string {
    const spaces = '  '.repeat(indent);
    let result = '';
    
    if (Array.isArray(obj)) {
        obj.forEach(item => {
            result += `${spaces}- ${formatYaml(item, indent + 1).trimStart()}\n`;
        });
    } else if (typeof obj === 'object' && obj !== null) {
        Object.entries(obj).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                result += `${spaces}${key}:\n`;
                value.forEach(item => {
                    result += `${spaces}  - ${formatYaml(item, indent + 2).trimStart()}\n`;
                });
            } else if (typeof value === 'object' && value !== null) {
                result += `${spaces}${key}:\n${formatYaml(value, indent + 1)}`;
            } else {
                result += `${spaces}${key}: ${value}\n`;
            }
        });
    } else {
        return String(obj);
    }
    
    return result;
}

export const provider: ConfigFileAuthenticationDetailsProvider = new ConfigFileAuthenticationDetailsProvider(
    configurationFilePath,
    profile
);

// Function to load ATP configuration from YAML file
function loadATPConfig(filePath: string): ATPConfig {
    try {
        const yamlContent = readFileSync(filePath, 'utf8');
        const config = parseYaml(yamlContent) as ATPConfig;
        
        // Set defaults for free tier ATP
        config.cpu_core_count = config.cpu_core_count || 1;
        config.data_storage_size_in_tbs = config.data_storage_size_in_tbs || 1;
        config.db_workload = config.db_workload || 'OLTP';
        config.is_free_tier = config.is_free_tier !== false; // Default to true
        config.is_auto_scaling_enabled = config.is_auto_scaling_enabled || false;
        config.license_model = config.license_model || 'LICENSE_INCLUDED';
        config.display_name = config.display_name || config.db_name;
        
        return config;
    } catch (error) {
        throw new Error(`Failed to load ATP configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Function to validate ATP configuration
function validateATPConfig(config: ATPConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!config.compartment_id) {
        errors.push('compartment_id is required');
    }
    if (!config.db_name) {
        errors.push('db_name is required');
    }
    if (!config.admin_password) {
        errors.push('admin_password is required');
    }
    
    // Validate db_name format
    if (config.db_name && !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(config.db_name)) {
        errors.push('db_name must start with a letter and contain only alphanumeric characters and underscores');
    }
    
    // Validate password complexity
    if (config.admin_password) {
        if (config.admin_password.length < 12 || config.admin_password.length > 30) {
            errors.push('admin_password must be between 12 and 30 characters');
        }
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[#_@$%^&+=])/.test(config.admin_password)) {
            errors.push('admin_password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (#_@$%^&+=)');
        }
    }
    
    // Free tier limitations
    if (config.is_free_tier) {
        if (config.cpu_core_count && config.cpu_core_count > 1) {
            warnings.push('Free tier ATP is limited to 1 OCPU. Setting cpu_core_count to 1');
            config.cpu_core_count = 1;
        }
        if (config.data_storage_size_in_tbs && config.data_storage_size_in_tbs > 1) {
            warnings.push('Free tier ATP is limited to 1TB storage. Setting data_storage_size_in_tbs to 1');
            config.data_storage_size_in_tbs = 1;
        }
        if (config.is_auto_scaling_enabled) {
            warnings.push('Auto-scaling is not available for free tier ATP. Disabling auto-scaling');
            config.is_auto_scaling_enabled = false;
        }
    }
    
    return { valid: errors.length === 0, errors, warnings };
}

// Function to check if ATP already exists
async function checkATPExists(config: ATPConfig): Promise<database.models.AutonomousDatabaseSummary | null> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
        const request: database.requests.ListAutonomousDatabasesRequest = {
            compartmentId: config.compartment_id,
            displayName: config.display_name
        };
        const response = await databaseClient.listAutonomousDatabases(request);
        
        // Look for ATP with matching name
        const existingATP = response.items.find(db => 
            db.displayName === config.display_name || db.dbName === config.db_name
        );
        
        return existingATP || null;
    } catch (error) {
        warn(`Could not check for existing ATP: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

// Function to create deployment plan
async function createDeploymentPlan(config: ATPConfig, action: string): Promise<DeploymentPlan> {
    const validation = validateATPConfig(config);
    
    let existingATP: database.models.AutonomousDatabaseSummary | null = null;
    if (validation.valid) {
        existingATP = await checkATPExists(config);
    }
    
    const plan: DeploymentPlan = {
        action,
        config,
        validation,
        estimated_resources: {
            autonomous_database: {
                id: existingATP?.id,
                name: config.display_name || config.db_name,
                cpu_cores: config.cpu_core_count || 1,
                storage_tb: config.data_storage_size_in_tbs || 1,
                workload_type: config.db_workload || 'OLTP',
                free_tier: config.is_free_tier !== false
            }
        }
    };
    
    // Add validation for action-specific scenarios
    if (action === 'apply' && existingATP) {
        validation.warnings.push(`ATP ${config.display_name} already exists. Operation will update existing instance.`);
    }
    
    if (action === 'destroy' && !existingATP) {
        validation.warnings.push(`ATP ${config.display_name} does not exist. Nothing to destroy.`);
    }
    
    return plan;
}

// Function to apply ATP deployment
async function applyATPDeployment(config: ATPConfig): Promise<database.models.AutonomousDatabase> {
    const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
    
    // Check if ATP already exists
    const existingATP = await checkATPExists(config);
    
    if (existingATP) {
        log(`Updating existing ATP: ${existingATP.displayName}`);
        
        // Update existing ATP
        const updateRequest: database.requests.UpdateAutonomousDatabaseRequest = {
            autonomousDatabaseId: existingATP.id,
            updateAutonomousDatabaseDetails: {
                displayName: config.display_name,
                cpuCoreCount: config.cpu_core_count,
                dataStorageSizeInTBs: config.data_storage_size_in_tbs,
                isAutoScalingEnabled: config.is_auto_scaling_enabled,
                whitelistedIps: config.whitelisted_ips
            }
        };
        
        const response = await databaseClient.updateAutonomousDatabase(updateRequest);
        return response.autonomousDatabase;
    } else {
        log(`Creating new ATP: ${config.display_name}`);
        
        // Create new ATP
        const createRequest: database.requests.CreateAutonomousDatabaseRequest = {
            createAutonomousDatabaseDetails: {
                source: "NONE" as any,
                compartmentId: config.compartment_id,
                dbName: config.db_name,
                displayName: config.display_name,
                adminPassword: config.admin_password,
                cpuCoreCount: config.cpu_core_count,
                dataStorageSizeInTBs: config.data_storage_size_in_tbs,
                dbWorkload: config.db_workload as any,
                isFreeTier: config.is_free_tier,
                isAutoScalingEnabled: config.is_auto_scaling_enabled,
                licenseModel: config.license_model as any,
                whitelistedIps: config.whitelisted_ips
            }
        };
        
        const response = await databaseClient.createAutonomousDatabase(createRequest);
        return response.autonomousDatabase;
    }
}

// Function to destroy ATP
async function destroyATPDeployment(config: ATPConfig): Promise<void> {
    const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
    
    // Find ATP to destroy
    const existingATP = await checkATPExists(config);
    
    if (!existingATP) {
        log(`ATP ${config.display_name} does not exist. Nothing to destroy.`);
        return;
    }
    
    log(`Terminating ATP: ${existingATP.displayName}`);
    
    const deleteRequest: database.requests.DeleteAutonomousDatabaseRequest = {
        autonomousDatabaseId: existingATP.id
    };
    
    await databaseClient.deleteAutonomousDatabase(deleteRequest);
}



// Main function
async function main() {
    try {
        log('OCI ATP Deployment Tool');
        log(`Config: ${configurationFilePath}`);
        log(`Profile: ${profile}`);
        log(`YAML File: ${yamlFile}`);
        log(`Action: ${action}`);
        
        const tenantId = await provider.getTenantId();
        log(`Connected to tenancy: ${tenantId}`);
        
        // Load ATP configuration
        const config = loadATPConfig(yamlFile);
        
        log('\n' + '='.repeat(60));
        log(`EXECUTING ${action.toUpperCase()} ACTION`);
        log('='.repeat(60));
        
        if (action === 'plan') {
            const plan = await createDeploymentPlan(config, action);
            console.log(formatYaml(plan).trimEnd());
        } else if (action === 'apply') {
            const plan = await createDeploymentPlan(config, action);
            
            // Show plan first
            if (!isQuiet) {
                log('\nDeployment Plan:');
                log(formatYaml(plan).trimEnd());
                log('\n' + '-'.repeat(40));
                log('Applying changes...\n');
            }
            
            if (!plan.validation.valid) {
                console.error('❌ Configuration validation failed:');
                plan.validation.errors.forEach(error => console.error(`  - ${error}`));
                process.exit(1);
            }
            
            // Show warnings
            plan.validation.warnings.forEach(warning => warn(`⚠️  ${warning}`));
            
            const result = await applyATPDeployment(config);
            
            const output = {
                action: 'apply',
                status: 'success',
                autonomous_database: {
                    id: result.id,
                    name: result.displayName || result.dbName,
                    db_name: result.dbName,
                    lifecycle_state: result.lifecycleState,
                    workload_type: result.dbWorkload,
                    cpu_core_count: result.cpuCoreCount,
                    data_storage_size_in_tbs: result.dataStorageSizeInTBs,
                    is_free_tier: result.isFreeTier,
                    connection_urls: result.connectionUrls,
                    time_created: result.timeCreated
                }
            };
            
            console.log(formatYaml(output).trimEnd());
            
            // Display connection URLs prominently if available
            if (result.connectionUrls) {
                log('\n' + '='.repeat(60));
                log('🌐 CONNECTION URLS - Ready to use in browser:');
                log('='.repeat(60));
                
                if (result.connectionUrls.apexUrl) {
                    log(`📱 APEX Application: ${result.connectionUrls.apexUrl}`);
                }
                if (result.connectionUrls.sqlDevWebUrl) {
                    log(`💻 SQL Developer Web: ${result.connectionUrls.sqlDevWebUrl}`);
                }
                if (result.connectionUrls.databaseTransformsUrl) {
                    log(`🎛️  Database Actions: ${result.connectionUrls.databaseTransformsUrl}`);
                }
                if (result.connectionUrls.graphStudioUrl) {
                    log(`📊 Graph Studio: ${result.connectionUrls.graphStudioUrl}`);
                }
                if (result.connectionUrls.machineLearningNotebookUrl) {
                    log(`🤖 Oracle ML Notebooks: ${result.connectionUrls.machineLearningNotebookUrl}`);
                }
                if (result.connectionUrls.ordsUrl) {
                    log(`🔧 ORDS Base URL: ${result.connectionUrls.ordsUrl}`);
                }
                
                // Access tips removed - only native connection URLs are displayed
            }
        } else if (action === 'destroy') {
            const plan = await createDeploymentPlan(config, action);
            
            if (!plan.validation.valid) {
                console.error('❌ Configuration validation failed:');
                plan.validation.errors.forEach(error => console.error(`  - ${error}`));
                process.exit(1);
            }
            
            await destroyATPDeployment(config);
            
            const output = {
                action: 'destroy',
                status: 'success',
                message: `ATP ${config.display_name} termination initiated`
            };
            
            console.log(formatYaml(output).trimEnd());
        }
        
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}