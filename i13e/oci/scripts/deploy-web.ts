#!/usr/bin/env tsx

import { ConfigFileAuthenticationDetailsProvider, core, identity } from 'oci-sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';

interface Args {
  configFile?: string;
  profile?: string;
  quiet?: boolean;
  yamlFile?: string;
  action?: 'plan' | 'apply' | 'destroy';
  force?: boolean;
}

interface WebConfig {
  compartment_id: string;
  domain: string;
  compute: {
    display_name: string;
    shape: string;
    shape_config?: {
      ocpus: number;
      memory_in_gbs: number;
    };
    availability_domain: string;
    image_id: string;
    boot_volume_size_in_gbs: number;
  };
  network: {
    vcn_display_name: string;
    vcn_cidr_block: string;
    subnet_display_name: string;
    subnet_cidr_block: string;
    internet_gateway_display_name: string;
  };
  security: {
    security_list_display_name: string;
    ingress_rules: Array<{
      protocol: string;
      source: string;
      source_port_range_min: number | null;
      source_port_range_max: number | null;
      destination_port_range_min: number;
      destination_port_range_max: number;
      description: string;
    }>;
  };
  ssh: {
    public_key_file: string;
    private_key_file: string;
  };
}

interface DeploymentPlan {
  action: string;
  config: WebConfig;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
  estimated_resources: {
    compute_instance?: {
      id?: string;
      name: string;
      shape: string;
      ocpus: number;
      memory_gb: number;
    };
    vcn?: {
      id?: string;
      name: string;
      cidr_block: string;
    };
    subnet?: {
      id?: string;
      name: string;
      cidr_block: string;
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
            case '--force':
                args.force = true;
                break;
            case '-h':
            case '--help':
                console.log('Usage: tsx deploy-web.ts [-c config-file] [-p profile] [-q] [-f yaml-file] [-a action] [--force]');
                console.log('  -c, --config     Path to OCI config file');
                console.log('  -p, --profile    Profile name to use');
                console.log('  -q, --quiet      Quiet mode - only show results');
                console.log('  -f, --file       Path to YAML file with web configuration');
                console.log('  -a, --action     Action to perform: plan, apply, destroy');
                console.log('  --force          Force cleanup during destroy (ignore some errors)');
                console.log('');
                console.log('Features:');
                console.log('  • Deploys OCI compute instance with basic system setup');
                console.log('  • Configures SSH key access for secure server management');
                console.log('  • Creates compute + network infrastructure');
                console.log('  • Generates SSH connection and file upload helper scripts');
                console.log('  • After successful apply, displays access information and SSH commands');
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
const yamlFile = args.yamlFile || join(__dirname, '..', 'templates', 'web.yaml');
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

// Function to load web configuration from YAML file
function loadWebConfig(filePath: string): WebConfig {
    try {
        const yamlContent = readFileSync(filePath, 'utf8');
        const config = parseYaml(yamlContent) as WebConfig;
        
        // Set defaults
        config.compute.shape_config = config.compute.shape_config || { ocpus: 1, memory_in_gbs: 16 };
        config.compute.boot_volume_size_in_gbs = config.compute.boot_volume_size_in_gbs || 50;
        
        return config;
    } catch (error) {
        throw new Error(`Failed to load web configuration from ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

// Function to validate web configuration
function validateWebConfig(config: WebConfig): { valid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // Required fields
    if (!config.compartment_id) {
        errors.push('compartment_id is required');
    }
    if (!config.domain) {
        errors.push('domain is required');
    }
    if (!config.compute?.display_name) {
        errors.push('compute.display_name is required');
    }
    if (!config.compute?.shape) {
        errors.push('compute.shape is required');
    }
    if (!config.compute?.availability_domain) {
        errors.push('compute.availability_domain is required');
    }
    if (!config.compute?.image_id) {
        errors.push('compute.image_id is required');
    }
    
    // Validate domain format
    if (config.domain && !/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}$/.test(config.domain)) {
        errors.push('domain must be a valid domain name (e.g., example.com)');
    }
    
    // Check SSH key files exist
    const sshDir = join(__dirname, '..', '.ssh');
    if (config.ssh) {
        const publicKeyPath = join(sshDir, config.ssh.public_key_file);
        const privateKeyPath = join(sshDir, config.ssh.private_key_file);
        
        if (!existsSync(publicKeyPath)) {
            errors.push(`SSH public key file not found: ${config.ssh.public_key_file}`);
        }
        if (!existsSync(privateKeyPath)) {
            warnings.push(`SSH private key file not found: ${config.ssh.private_key_file}`);
        }
    }
    
    return { valid: errors.length === 0, errors, warnings };
}

// Function to check if resources already exist
async function checkResourcesExist(config: WebConfig): Promise<{
    compute?: core.models.Instance;
    vcn?: core.models.Vcn;
    subnet?: core.models.Subnet;
    internetGateway?: any;
    securityList?: any;
}> {
    try {
        const computeClient = new core.ComputeClient({ authenticationDetailsProvider: provider });
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
        
        const result: any = {};
        
        // Check for existing compute instance
        const instancesResponse = await computeClient.listInstances({
            compartmentId: config.compartment_id,
            displayName: config.compute.display_name
        });
        result.compute = instancesResponse.items.find(instance => 
            instance.displayName === config.compute.display_name
        );
        
        // Check for existing VCN
        const vcnsResponse = await networkClient.listVcns({
            compartmentId: config.compartment_id,
            displayName: config.network.vcn_display_name
        });
        result.vcn = vcnsResponse.items.find(vcn => 
            vcn.displayName === config.network.vcn_display_name
        );
        
        // Check for existing resources within VCN
        if (result.vcn) {
            // Check for existing subnet
            const subnetsResponse = await networkClient.listSubnets({
                compartmentId: config.compartment_id,
                vcnId: result.vcn.id,
                displayName: config.network.subnet_display_name
            });
            result.subnet = subnetsResponse.items.find(subnet => 
                subnet.displayName === config.network.subnet_display_name
            );
            
            // Check for existing Internet Gateway
            const igwsResponse = await networkClient.listInternetGateways({
                compartmentId: config.compartment_id,
                vcnId: result.vcn.id,
                displayName: config.network.internet_gateway_display_name
            });
            result.internetGateway = igwsResponse.items.find(igw => 
                igw.displayName === config.network.internet_gateway_display_name
            );
            
            // Check for existing Security List
            const slsResponse = await networkClient.listSecurityLists({
                compartmentId: config.compartment_id,
                vcnId: result.vcn.id,
                displayName: config.security.security_list_display_name
            });
            result.securityList = slsResponse.items.find(sl => 
                sl.displayName === config.security.security_list_display_name
            );
        }
        
        return result;
    } catch (error) {
        warn(`Could not check for existing resources: ${error instanceof Error ? error.message : String(error)}`);
        return {};
    }
}

// Function to create deployment plan
async function createDeploymentPlan(config: WebConfig, action: string): Promise<DeploymentPlan> {
    const validation = validateWebConfig(config);
    
    let existingResources: any = {};
    if (validation.valid) {
        existingResources = await checkResourcesExist(config);
    }
    
    const plan: DeploymentPlan = {
        action,
        config,
        validation,
        estimated_resources: {
            compute_instance: {
                id: existingResources.compute?.id,
                name: config.compute.display_name,
                shape: config.compute.shape,
                ocpus: config.compute.shape_config?.ocpus || 1,
                memory_gb: config.compute.shape_config?.memory_in_gbs || 16
            },
            vcn: {
                id: existingResources.vcn?.id,
                name: config.network.vcn_display_name,
                cidr_block: config.network.vcn_cidr_block
            },
            subnet: {
                id: existingResources.subnet?.id,
                name: config.network.subnet_display_name,
                cidr_block: config.network.subnet_cidr_block
            }
        }
    };
    
    // Add validation for action-specific scenarios
    if (action === 'apply' && existingResources.compute) {
        validation.warnings.push(`Compute instance ${config.compute.display_name} already exists. Will update configuration.`);
    }
    
    if (action === 'destroy' && !existingResources.compute) {
        validation.warnings.push(`Compute instance ${config.compute.display_name} does not exist. Nothing to destroy.`);
    }
    
    return plan;
}

// Function to apply web deployment
async function applyWebDeployment(config: WebConfig): Promise<any> {
    const computeClient = new core.ComputeClient({ authenticationDetailsProvider: provider });
    const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
    const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: provider });
    
    // Get availability domains
    const adsResponse = await identityClient.listAvailabilityDomains({
        compartmentId: config.compartment_id
    });
    const availabilityDomain = adsResponse.items.find(ad => 
        ad.name?.includes(config.compute.availability_domain)
    ) || adsResponse.items[0];
    
    // Check existing resources
    const existingResources = await checkResourcesExist(config);
    
    let vcn = existingResources.vcn;
    let subnet = existingResources.subnet;
    let internetGateway: any = null;
    let securityList: any = null;
    
    // Create VCN if it doesn't exist
    if (!vcn) {
        log('Creating VCN...');
        const vcnResponse = await networkClient.createVcn({
            createVcnDetails: {
                compartmentId: config.compartment_id,
                displayName: config.network.vcn_display_name,
                cidrBlock: config.network.vcn_cidr_block
            }
        });
        vcn = vcnResponse.vcn;
    }
    
    // Create Internet Gateway
    if (vcn) {
        const igwsResponse = await networkClient.listInternetGateways({
            compartmentId: config.compartment_id,
            vcnId: vcn.id,
            displayName: config.network.internet_gateway_display_name
        });
        
        internetGateway = igwsResponse.items.find(igw => 
            igw.displayName === config.network.internet_gateway_display_name
        );
        
        if (!internetGateway) {
            log('Creating Internet Gateway...');
            const igwResponse = await networkClient.createInternetGateway({
                createInternetGatewayDetails: {
                    compartmentId: config.compartment_id,
                    vcnId: vcn.id!,
                    displayName: config.network.internet_gateway_display_name,
                    isEnabled: true
                }
            });
            internetGateway = igwResponse.internetGateway;
        }
    }
    
    // Configure route table to route traffic to Internet Gateway
    if (vcn && internetGateway) {
        log('Configuring route table...');
        
        // Get the default route table
        const routeTableResponse = await networkClient.getRouteTable({
            rtId: vcn.defaultRouteTableId!
        });
        
        const routeTable = routeTableResponse.routeTable;
        
        // Check if route rule for 0.0.0.0/0 to Internet Gateway already exists
        const hasInternetRoute = routeTable.routeRules?.some(rule => 
            rule.destination === '0.0.0.0/0' && 
            rule.networkEntityId === internetGateway.id
        );
        
        if (!hasInternetRoute) {
            log('Adding Internet Gateway route rule...');
            
            // Prepare the updated route rules
            const existingRules = routeTable.routeRules || [];
            const newRouteRules = [
                ...existingRules,
                {
                    destination: '0.0.0.0/0',
                    destinationType: 'CIDR_BLOCK' as any,
                    networkEntityId: internetGateway.id!
                }
            ];
            
            // Update the route table with the new rules
            await networkClient.updateRouteTable({
                rtId: vcn.defaultRouteTableId!,
                updateRouteTableDetails: {
                    routeRules: newRouteRules
                }
            });
            
            log('✅ Route rule created: 0.0.0.0/0 → Internet Gateway');
        } else {
            log('✅ Internet Gateway route rule already exists');
        }
    }
    
    // Create Security List
    if (vcn) {
        const slsResponse = await networkClient.listSecurityLists({
            compartmentId: config.compartment_id,
            vcnId: vcn.id,
            displayName: config.security.security_list_display_name
        });
        
        securityList = slsResponse.items.find(sl => 
            sl.displayName === config.security.security_list_display_name
        );
        
        if (!securityList) {
            log('Creating Security List...');
            const ingressRules = config.security.ingress_rules.map(rule => ({
                protocol: rule.protocol,
                source: rule.source,
                sourceType: 'CIDR_BLOCK' as any,
                tcpOptions: rule.protocol === '6' ? {
                    destinationPortRange: {
                        min: rule.destination_port_range_min,
                        max: rule.destination_port_range_max
                    }
                } : undefined
            }));
            
            const slResponse = await networkClient.createSecurityList({
                createSecurityListDetails: {
                    compartmentId: config.compartment_id,
                    vcnId: vcn.id!,
                    displayName: config.security.security_list_display_name,
                    ingressSecurityRules: ingressRules,
                    egressSecurityRules: [{
                        protocol: 'all',
                        destination: '0.0.0.0/0',
                        destinationType: 'CIDR_BLOCK' as any
                    }]
                }
            });
            securityList = slResponse.securityList;
        }
    }
    
    // Create subnet if it doesn't exist
    if (!subnet && vcn && securityList) {
        log('Creating Subnet...');
        const subnetResponse = await networkClient.createSubnet({
            createSubnetDetails: {
                compartmentId: config.compartment_id,
                vcnId: vcn.id!,
                displayName: config.network.subnet_display_name,
                cidrBlock: config.network.subnet_cidr_block,
                securityListIds: [securityList.id!],
                routeTableId: vcn.defaultRouteTableId!
            }
        });
        subnet = subnetResponse.subnet;
    }
    
    // Create compute instance
    let instance = existingResources.compute;
    if (!instance && subnet) {
        log('Creating compute instance...');
        
        // Generate cloud-init script
        const cloudInitScript = `#!/bin/bash
# Cloud-init script for OCI compute instance deployment
# Enable logging and error handling
exec > >(tee /var/log/cloud-init-custom.log) 2>&1
set -x  # Enable debug output
echo "Starting cloud-init script at $(date)"

# Function for error handling
handle_error() {
    echo "ERROR: $1" >&2
    echo "Cloud-init script failed at $(date)" >&2
    exit 1
}

# Wait for system to be ready
echo "Waiting for system to stabilize..."
sleep 30

# Update system packages
echo "Updating system packages..."
yum update -y || handle_error "Failed to update system packages"

# Install basic packages
echo "Installing basic packages..."
yum install -y curl wget htop vim || handle_error "Failed to install basic packages"

echo "Cloud-init script completed successfully at $(date)"
`;
        
        // Read SSH public key
        const sshDir = join(__dirname, '..', '.ssh');
        const publicKeyPath = join(sshDir, config.ssh.public_key_file);
        const publicKey = readFileSync(publicKeyPath, 'utf8').trim();
        
        const createInstanceResponse = await computeClient.launchInstance({
            launchInstanceDetails: {
                compartmentId: config.compartment_id,
                displayName: config.compute.display_name,
                availabilityDomain: availabilityDomain!.name!,
                shape: config.compute.shape,
                shapeConfig: config.compute.shape_config ? {
                    ocpus: config.compute.shape_config.ocpus,
                    memoryInGBs: config.compute.shape_config.memory_in_gbs
                } : undefined,
                sourceDetails: {
                    sourceType: 'image',
                    imageId: config.compute.image_id,
                    bootVolumeSizeInGBs: config.compute.boot_volume_size_in_gbs
                } as any,
                createVnicDetails: {
                    subnetId: subnet.id!,
                    assignPublicIp: true
                },
                metadata: {
                    'user_data': Buffer.from(cloudInitScript).toString('base64'),
                    'ssh_authorized_keys': publicKey
                }
            }
        });
        instance = createInstanceResponse.instance;
    }
    
    return {
        instance,
        vcn,
        subnet,
        internetGateway,
        securityList,
        routeTableConfigured: true
    };
}

// Function to destroy web deployment
async function destroyWebDeployment(config: WebConfig): Promise<void> {
    const computeClient = new core.ComputeClient({ authenticationDetailsProvider: provider });
    const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
    
    log('Starting complete resource cleanup...');
    
    // Find resources to destroy
    const existingResources = await checkResourcesExist(config);
    
    // Step 1: Terminate compute instance
    if (existingResources.compute) {
        log(`Terminating compute instance: ${existingResources.compute.displayName}`);
        await computeClient.terminateInstance({
            instanceId: existingResources.compute.id!
        });
        
        // Wait for instance to be terminated
        log('Waiting for instance to be terminated...');
        let instanceState = 'TERMINATING';
        while (instanceState === 'TERMINATING') {
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            try {
                const instanceResponse = await computeClient.getInstance({
                    instanceId: existingResources.compute.id!
                });
                instanceState = instanceResponse.instance.lifecycleState!;
                log(`Instance state: ${instanceState}`);
            } catch (error) {
                // Instance might not exist anymore, which is what we want
                instanceState = 'TERMINATED';
            }
        }
        log('✅ Compute instance terminated');
    } else {
        log('No compute instance found to terminate');
    }
    
    // Step 2: Delete subnet (must be done before VCN)
    if (existingResources.subnet) {
        log(`Deleting subnet: ${existingResources.subnet.displayName}`);
        try {
            await networkClient.deleteSubnet({
                subnetId: existingResources.subnet.id!
            });
            log('✅ Subnet deleted');
        } catch (error) {
            warn(`Failed to delete subnet: ${error instanceof Error ? error.message : String(error)}`);
        }
    } else {
        log('No subnet found to delete');
    }
    
    // Step 3: Delete security list (if it's not the default one)
    if (existingResources.securityList && existingResources.securityList.displayName !== 'Default Security List for ' + config.network.vcn_display_name) {
        log(`Deleting security list: ${existingResources.securityList.displayName}`);
        try {
            await networkClient.deleteSecurityList({
                securityListId: existingResources.securityList.id!
            });
            log('✅ Security list deleted');
        } catch (error) {
            warn(`Failed to delete security list: ${error instanceof Error ? error.message : String(error)}`);
        }
    } else {
        log('No custom security list found to delete');
    }
    
    // Step 4: Clear route table rules (reset to empty)
    if (existingResources.vcn && existingResources.internetGateway) {
        log('Clearing route table rules...');
        try {
            await networkClient.updateRouteTable({
                rtId: existingResources.vcn.defaultRouteTableId!,
                updateRouteTableDetails: {
                    routeRules: [] // Clear all route rules
                }
            });
            log('✅ Route table rules cleared');
        } catch (error) {
            warn(`Failed to clear route table: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    // Step 5: Delete internet gateway
    if (existingResources.internetGateway) {
        log(`Deleting internet gateway: ${existingResources.internetGateway.displayName}`);
        try {
            await networkClient.deleteInternetGateway({
                igId: existingResources.internetGateway.id!
            });
            log('✅ Internet gateway deleted');
        } catch (error) {
            warn(`Failed to delete internet gateway: ${error instanceof Error ? error.message : String(error)}`);
        }
    } else {
        log('No internet gateway found to delete');
    }
    
    // Step 6: Delete VCN (must be last)
    if (existingResources.vcn) {
        log(`Deleting VCN: ${existingResources.vcn.displayName}`);
        try {
            await networkClient.deleteVcn({
                vcnId: existingResources.vcn.id!
            });
            log('✅ VCN deleted');
        } catch (error) {
            warn(`Failed to delete VCN: ${error instanceof Error ? error.message : String(error)}`);
            warn('VCN deletion might fail if there are still dependent resources. Check OCI console for remaining resources.');
        }
    } else {
        log('No VCN found to delete');
    }
    
    log('🧹 Complete resource cleanup finished');
}

// Function to create SSH connection helper scripts
function createSSHHelperScripts(config: WebConfig, publicIP: string): void {
    const sshDir = join(__dirname, '..', '.ssh');
    const privateKeyPath = join(sshDir, config.ssh.private_key_file);
    
    // Create SSH connection script for Windows (PowerShell) - using simple string concatenation
    const sshScriptWindows = [
        '# SSH Connection Script for ' + config.compute.display_name,
        '# Usage: .\\ssh-connect.ps1',
        '',
        '$privateKeyPath = "' + privateKeyPath.replace(/\\/g, '\\\\') + '"',
        '$serverIP = "' + publicIP + '"',
        '$username = "opc"  # Default Oracle Linux user',
        '',
        'Write-Host "Connecting to $serverIP as $username..."',
        'Write-Host "Private key: $privateKeyPath"',
        '',
        'ssh -i "$privateKeyPath" "$username@$serverIP"'
    ].join('\n');

    // Create SSH connection script for Unix/Linux/macOS
    const sshScriptUnix = [
        '#!/bin/bash',
        '# SSH Connection Script for ' + config.compute.display_name,
        '# Usage: ./ssh-connect.sh',
        '',
        'PRIVATE_KEY_PATH="' + privateKeyPath + '"',
        'SERVER_IP="' + publicIP + '"',
        'USERNAME="opc"  # Default Oracle Linux user',
        '',
        'echo "Connecting to $SERVER_IP as $USERNAME..."',
        'echo "Private key: $PRIVATE_KEY_PATH"',
        '',
        'ssh -i "$PRIVATE_KEY_PATH" "$USERNAME@$SERVER_IP"'
    ].join('\n');

    // Create SCP upload helper script
    const scpScriptWindows = [
        '# SCP File Upload Script for ' + config.compute.display_name,
        '# Usage: .\\upload-files.ps1',
        '',
        '$privateKeyPath = "' + privateKeyPath.replace(/\\/g, '\\\\') + '"',
        '$serverIP = "' + publicIP + '"',
        '$username = "opc"',
        '',
        'Write-Host "Basic SCP upload example:"',
        'Write-Host ""',
        'Write-Host "# Upload files to server:"',
        'Write-Host "scp -i `"$privateKeyPath`" <local-file> `"$username@$serverIP:/tmp/`""',
        'Write-Host ""',
        'Write-Host "# SSH into server to manage files:"',
        'Write-Host "ssh -i `"$privateKeyPath`" `"$username@$serverIP`""'
    ].join('\n');

    // Write the scripts
    const scriptsDir = join(sshDir, 'scripts');
    if (!existsSync(scriptsDir)) {
        mkdirSync(scriptsDir, { recursive: true });
    }
    
    writeFileSync(join(scriptsDir, 'ssh-connect.ps1'), sshScriptWindows);
    writeFileSync(join(scriptsDir, 'ssh-connect.sh'), sshScriptUnix);
    writeFileSync(join(scriptsDir, 'upload-files.ps1'), scpScriptWindows);
    
    log(`📁 SSH helper scripts created in: ${scriptsDir}`);
}

// Function to get instance public IP
async function getInstancePublicIP(instanceId: string, compartmentId: string): Promise<string | null> {
    try {
        const computeClient = new core.ComputeClient({ authenticationDetailsProvider: provider });
        
        const vnicAttachmentsResponse = await computeClient.listVnicAttachments({
            compartmentId: compartmentId,
            instanceId: instanceId
        });
        
        if (vnicAttachmentsResponse.items.length > 0) {
            const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
            const vnicResponse = await networkClient.getVnic({
                vnicId: vnicAttachmentsResponse.items[0].vnicId!
            });
            
            return vnicResponse.vnic.publicIp || null;
        }
        
        return null;
    } catch (error) {
        warn(`Could not get public IP: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

// Main function
async function main() {
    try {
        log('OCI Compute Deployment Tool');
        log(`Config: ${configurationFilePath}`);
        log(`Profile: ${profile}`);
        log(`YAML File: ${yamlFile}`);
        log(`Action: ${action}`);
        
        const tenantId = await provider.getTenantId();
        log(`Connected to tenancy: ${tenantId}`);
        
        // Load web configuration
        const config = loadWebConfig(yamlFile);
        
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
            
            const result = await applyWebDeployment(config);
            
            // Get public IP
            const publicIP = result.instance ? await getInstancePublicIP(result.instance.id, config.compartment_id) : null;
            
            const output = {
                action: 'apply',
                status: 'success',
                compute_instance: {
                    id: result.instance?.id,
                    name: result.instance?.displayName,
                    shape: result.instance?.shape,
                    lifecycle_state: result.instance?.lifecycleState,
                    public_ip: publicIP,
                    time_created: result.instance?.timeCreated
                },
                network: {
                    vcn_id: result.vcn?.id,
                    subnet_id: result.subnet?.id,
                    internet_gateway_id: result.internetGateway?.id,
                    route_table_configured: result.routeTableConfigured
                }
            };
            
            console.log(formatYaml(output).trimEnd());
            
            // Display access URLs prominently
            if (publicIP) {
                // Create SSH helper scripts
                createSSHHelperScripts(config, publicIP);
                
                log('\n' + '='.repeat(60));
                log('🌐 COMPUTE INSTANCE CREATED:');
                log('='.repeat(60));
                log(`📍 Server IP: ${publicIP}`);
                log('\n� Note: You can now configure your server as needed.');
                
                log('\n🔐 SSH ACCESS:');
                log(`   ssh -i ${join('.ssh', config.ssh.private_key_file)} opc@${publicIP}`);
                log(`   Or use helper script: .ssh/scripts/ssh-connect.ps1`);
                
                log('\n📦 FILE UPLOAD:');
                log(`   Use helper script: .ssh/scripts/upload-files.ps1`);
                log(`   Or manually: scp -i ${join('.ssh', config.ssh.private_key_file)} <local-file> opc@${publicIP}:/tmp/`);
            }
        } else if (action === 'destroy') {
            const plan = await createDeploymentPlan(config, action);
            
            if (!plan.validation.valid) {
                console.error('❌ Configuration validation failed:');
                plan.validation.errors.forEach(error => console.error(`  - ${error}`));
                process.exit(1);
            }
            
            await destroyWebDeployment(config);
            
            const output = {
                action: 'destroy',
                status: 'success',
                message: `Complete resource cleanup finished for ${config.compute.display_name}`,
                resources_cleaned: [
                    'compute_instance',
                    'subnet',
                    'security_list',
                    'internet_gateway',
                    'route_table_rules',
                    'vcn'
                ]
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