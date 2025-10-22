#!/usr/bin/env tsx

import { ConfigFileAuthenticationDetailsProvider, database, common } from 'oci-sdk';
import { readFileSync, writeFileSync, createWriteStream } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { parse as parseYaml } from 'yaml';
import { mkdirSync } from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

interface Args {
  configFile?: string;
  profile?: string;
  quiet?: boolean;
  yamlFile?: string;
  walletPath?: string;
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
            case '-w':
            case '--wallet':
                args.walletPath = argv[++i];
                break;
            case '-h':
            case '--help':
                console.log('Usage: tsx download-wallet.ts [-c config-file] [-p profile] [-q] [-f yaml-file] -w wallet-path');
                console.log('  -c, --config     Path to OCI config file');
                console.log('  -p, --profile    Profile name to use');
                console.log('  -q, --quiet      Quiet mode - only show results');
                console.log('  -f, --file       Path to YAML file with ATP configuration');
                console.log('  -w, --wallet     Path and filename for downloaded wallet file (required)');
                console.log('');
                console.log('Features:');
                console.log('  • Downloads wallet file for existing ATP instance');
                console.log('  • Displays database connection strings and APEX/ATC URLs');
                console.log('  • Shows all available connection endpoints');
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
const walletPath = args.walletPath;

// Validate required arguments
if (!walletPath) {
    console.error('❌ Error: Wallet path (-w) is required');
    console.log('Usage: tsx download-wallet.ts [-c config-file] [-p profile] [-q] [-f yaml-file] -w wallet-path');
    process.exit(1);
}

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

// Function to find ATP by name
async function findATP(config: ATPConfig): Promise<database.models.AutonomousDatabaseSummary | null> {
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
        throw new Error(`Failed to find ATP: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Function to get full ATP details
async function getATPDetails(atpId: string): Promise<database.models.AutonomousDatabase> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
        const request: database.requests.GetAutonomousDatabaseRequest = {
            autonomousDatabaseId: atpId
        };
        const response = await databaseClient.getAutonomousDatabase(request);
        return response.autonomousDatabase;
    } catch (error) {
        throw new Error(`Failed to get ATP details: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Function to download wallet
async function downloadWallet(atpId: string, walletFilePath: string, password: string): Promise<void> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
        
        // Create directory if it doesn't exist
        const walletDir = dirname(walletFilePath);
        mkdirSync(walletDir, { recursive: true });
        
        const request: database.requests.GenerateAutonomousDatabaseWalletRequest = {
            autonomousDatabaseId: atpId,
            generateAutonomousDatabaseWalletDetails: {
                password: password,
                generateType: database.models.GenerateAutonomousDatabaseWalletDetails.GenerateType.Single
            }
        };
        
        log(`Downloading wallet to: ${walletFilePath}`);
        const response = await databaseClient.generateAutonomousDatabaseWallet(request);
        
        // Handle different response types
        if (response.value instanceof ReadableStream) {
            // Handle web ReadableStream
            const reader = response.value.getReader();
            const chunks: Uint8Array[] = [];
            
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    chunks.push(value);
                }
            } finally {
                reader.releaseLock();
            }
            
            // Combine chunks and write to file
            const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
            const combined = new Uint8Array(totalLength);
            let offset = 0;
            for (const chunk of chunks) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }
            
            writeFileSync(walletFilePath, Buffer.from(combined));
        } else if (response.value instanceof Readable) {
            // Handle Node.js Readable stream
            const writeStream = createWriteStream(walletFilePath);
            await pipeline(response.value, writeStream);
        } else if (Buffer.isBuffer(response.value)) {
            // Handle Buffer directly
            writeFileSync(walletFilePath, response.value);
        } else {
            // Handle other types (string, etc.)
            writeFileSync(walletFilePath, response.value as any);
        }
        
        log(`✅ Wallet downloaded successfully: ${walletFilePath}`);
        
    } catch (error) {
        throw new Error(`Failed to download wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Function to generate connection strings
function generateConnectionStrings(atpDetails: database.models.AutonomousDatabase): any {
    const dbName = atpDetails.dbName;
    const serviceName = atpDetails.dbName; // Use dbName as serviceName since serviceName doesn't exist on the type
    
    // Basic connection template
    const connectionTemplate = (service: string, description: string) => ({
        service: service,
        description: description,
        jdbc_thin: `jdbc:oracle:thin:@${serviceName}_${service}?TNS_ADMIN=./wallet`,
        jdbc_oci: `jdbc:oracle:oci:@${serviceName}_${service}`,
        sqlplus: `sqlplus admin/<password>@${serviceName}_${service}`,
        sql_developer: `admin@${serviceName}_${service}`,
        python_cx_oracle: `admin/<password>@${serviceName}_${service}`,
        node_oracledb: `admin/<password>@${serviceName}_${service}`
    });
    
    return {
        high: connectionTemplate('high', 'High performance, maximum resources'),
        medium: connectionTemplate('medium', 'Balanced performance and resources'),
        low: connectionTemplate('low', 'Serial execution, minimum resources'),
        tp: connectionTemplate('tp', 'Transaction Processing workload'),
        tpurgent: connectionTemplate('tpurgent', 'Highest priority transaction processing')
    };
}

// Main function
async function main() {
    try {
        log('OCI ATP Wallet Download Tool');
        log(`Config: ${configurationFilePath}`);
        log(`Profile: ${profile}`);
        log(`YAML File: ${yamlFile}`);
        log(`Wallet Path: ${walletPath}`);
        
        const tenantId = await provider.getTenantId();
        log(`Connected to tenancy: ${tenantId}`);
        
        // Load ATP configuration
        const config = loadATPConfig(yamlFile);
        
        log('\n' + '='.repeat(60));
        log('DOWNLOADING WALLET AND CONNECTION INFO');
        log('='.repeat(60));
        
        // Find the ATP instance
        const atpSummary = await findATP(config);
        if (!atpSummary) {
            console.error(`❌ ATP instance not found: ${config.display_name || config.db_name}`);
            console.error('Make sure the ATP instance exists and the configuration is correct.');
            process.exit(1);
        }
        
        log(`Found ATP: ${atpSummary.displayName} (${atpSummary.id})`);
        
        // Get full ATP details
        const atpDetails = await getATPDetails(atpSummary.id);
        
        // Check if ATP is available
        if (atpDetails.lifecycleState !== 'AVAILABLE') {
            console.error(`❌ ATP is not available. Current state: ${atpDetails.lifecycleState}`);
            console.error('Wait for the ATP to become available before downloading the wallet.');
            process.exit(1);
        }
        
        // Download wallet
        if (!config.admin_password) {
            console.error('❌ admin_password is required in the configuration file');
            process.exit(1);
        }
        await downloadWallet(atpSummary.id, walletPath!, config.admin_password as string);
        
        // Generate connection strings
        const connectionStrings = generateConnectionStrings(atpDetails);
        
        // Prepare output
        const output = {
            action: 'download-wallet',
            status: 'success',
            autonomous_database: {
                id: atpDetails.id,
                name: atpDetails.displayName || atpDetails.dbName,
                db_name: atpDetails.dbName,
                service_name: atpDetails.dbName, // Use dbName since serviceName doesn't exist
                lifecycle_state: atpDetails.lifecycleState,
                workload_type: atpDetails.dbWorkload,
                is_free_tier: atpDetails.isFreeTier,
                connection_urls: atpDetails.connectionUrls,
                time_created: atpDetails.timeCreated
            },
            wallet: {
                file_path: walletPath,
                download_time: new Date().toISOString()
            },
            connection_strings: connectionStrings
        };
        
        console.log(formatYaml(output).trimEnd());
        
        // Display connection URLs prominently if available
        if (atpDetails.connectionUrls) {
            log('\n' + '='.repeat(60));
            log('🌐 WEB INTERFACE URLS - Ready to use in browser:');
            log('='.repeat(60));
            
            if (atpDetails.connectionUrls.apexUrl) {
                log(`📱 APEX Application: ${atpDetails.connectionUrls.apexUrl}`);
            }
            if (atpDetails.connectionUrls.sqlDevWebUrl) {
                log(`💻 SQL Developer Web: ${atpDetails.connectionUrls.sqlDevWebUrl}`);
            }
            if (atpDetails.connectionUrls.databaseTransformsUrl) {
                log(`🎛️  Database Actions: ${atpDetails.connectionUrls.databaseTransformsUrl}`);
            }
            if (atpDetails.connectionUrls.graphStudioUrl) {
                log(`📊 Graph Studio: ${atpDetails.connectionUrls.graphStudioUrl}`);
            }
            if (atpDetails.connectionUrls.machineLearningNotebookUrl) {
                log(`🤖 Oracle ML Notebooks: ${atpDetails.connectionUrls.machineLearningNotebookUrl}`);
            }
            if (atpDetails.connectionUrls.ordsUrl) {
                log(`🔧 ORDS Base URL: ${atpDetails.connectionUrls.ordsUrl}`);
            }
        }
        
        // Display connection string examples
        log('\n' + '='.repeat(60));
        log('📋 DATABASE CONNECTION EXAMPLES:');
        log('='.repeat(60));
        log(`Service Name: ${atpDetails.dbName}`);
        log(`Database Name: ${atpDetails.dbName}`);
        log(`Admin User: admin`);
        log(`Wallet Location: ${walletPath}`);
        log('');
        log('SQL*Plus Examples:');
        log(`  sqlplus admin/<password>@${atpDetails.dbName}_high`);
        log(`  sqlplus admin/<password>@${atpDetails.dbName}_medium`);
        log(`  sqlplus admin/<password>@${atpDetails.dbName}_low`);
        log('');
        log('JDBC Thin Examples:');
        const walletDir = dirname(walletPath!);
        log(`  jdbc:oracle:thin:@${atpDetails.dbName}_high?TNS_ADMIN=${walletDir}`);
        log(`  jdbc:oracle:thin:@${atpDetails.dbName}_medium?TNS_ADMIN=${walletDir}`);
        log('');
        log('SQL Developer Connection:');
        log(`  Username: admin`);
        log(`  Password: <your_admin_password>`);
        log(`  Connection Type: Cloud Wallet`);
        log(`  Configuration File: ${walletPath}`);
        log(`  Service: ${atpDetails.dbName}_high (or _medium, _low)`);
        
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}