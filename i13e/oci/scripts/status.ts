#!/usr/bin/env tsx

import { ConfigFileAuthenticationDetailsProvider, core, identity, objectstorage, database, containerengine, common } from 'oci-sdk';
import { homedir } from 'os';
import { join } from 'path';

interface Args {
  configFile?: string;
  profile?: string;
  quiet?: boolean;
}

interface ResourceSummary {
  service: string;
  resourceType: string;
  count: number;
  resources: any[];
}

// Parse command line arguments for config file and profile
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
            case '-h':
            case '--help':
                console.log('Usage: tsx status.ts [-c path-to-config-file] [-p profile] [-q|--quiet]');
                console.log('  -c, --config     Path to OCI config file');
                console.log('  -p, --profile    Profile name to use');
                console.log('  -q, --quiet      Quiet mode - only show results');
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

// Function to get all compartments
async function getAllCompartments(): Promise<identity.models.Compartment[]> {
    const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: provider });
    const tenantId = await provider.getTenantId();
    
    const compartments: identity.models.Compartment[] = [];
    
    // Get root compartment (tenancy)
    const tenancyRequest: identity.requests.GetCompartmentRequest = { compartmentId: tenantId };
    const tenancyResponse = await identityClient.getCompartment(tenancyRequest);
    compartments.push(tenancyResponse.compartment);
    log(`  Root compartment: ${tenancyResponse.compartment.name} (${tenancyResponse.compartment.id})`);
    
    // Get all child compartments recursively
    const listCompartmentsRequest: identity.requests.ListCompartmentsRequest = {
        compartmentId: tenantId,
        compartmentIdInSubtree: true,
        accessLevel: identity.requests.ListCompartmentsRequest.AccessLevel.Accessible
    };
    const compartmentResponse = await identityClient.listCompartments(listCompartmentsRequest);
    
    compartmentResponse.items.forEach(comp => {
        log(`  Child compartment: ${comp.name} (${comp.id}) - State: ${comp.lifecycleState}`);
        compartments.push(comp);
    });
    
    return compartments;
}

// Function to get compute instances in a compartment
async function getComputeInstances(compartmentId: string): Promise<core.models.Instance[]> {
    const computeClient = new core.ComputeClient({ authenticationDetailsProvider: provider });
    const request: core.requests.ListInstancesRequest = { compartmentId };
    const response = await computeClient.listInstances(request);
    return response.items;
}

// Function to get VCNs in a compartment
async function getVCNs(compartmentId: string): Promise<core.models.Vcn[]> {
    const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
    const request: core.requests.ListVcnsRequest = { compartmentId };
    const response = await networkClient.listVcns(request);
    return response.items;
}

// Function to get buckets in a compartment
async function getBuckets(compartmentId: string): Promise<objectstorage.models.BucketSummary[]> {
    try {
        const objectStorageClient = new objectstorage.ObjectStorageClient({ authenticationDetailsProvider: provider });
        
        // Get namespace first
        const namespaceResponse = await objectStorageClient.getNamespace({});
        const namespaceName = namespaceResponse.value;
        
        const request: objectstorage.requests.ListBucketsRequest = {
            namespaceName,
            compartmentId
        };
        const response = await objectStorageClient.listBuckets(request);
        return response.items;
    } catch (error) {
        warn(`Could not list buckets for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

// Function to get DB systems in a compartment
async function getDBSystems(compartmentId: string): Promise<database.models.DbSystemSummary[]> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
        const request: database.requests.ListDbSystemsRequest = { compartmentId };
        const response = await databaseClient.listDbSystems(request);
        return response.items;
    } catch (error) {
        warn(`Could not list DB systems for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

// Function to get Autonomous Databases in a compartment
async function getAutonomousDatabases(compartmentId: string): Promise<database.models.AutonomousDatabaseSummary[]> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: provider });
        const request: database.requests.ListAutonomousDatabasesRequest = { compartmentId };
        const response = await databaseClient.listAutonomousDatabases(request);
        return response.items;
    } catch (error) {
        warn(`Could not list Autonomous Databases for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

// Function to discover all resources
async function discoverAllResources(): Promise<ResourceSummary[]> {
    const resourceSummaries: ResourceSummary[] = [];
    
    try {
        log('Discovering compartments...');
        const compartments = await getAllCompartments();
        log(`Found ${compartments.length} compartments`);
        
        for (const compartment of compartments) {
            log(`\nScanning compartment: ${compartment.name} (${compartment.id})`);
            
            // Get compute instances
            try {
                const instances = await getComputeInstances(compartment.id);
                if (instances.length > 0) {
                    resourceSummaries.push({
                        service: 'compute',
                        resourceType: 'instances',
                        count: instances.length,
                        resources: instances.map(i => ({
                            id: i.id,
                            name: i.displayName,
                            lifecycle_state: i.lifecycleState,
                            availability_domain: i.availabilityDomain,
                            shape: i.shape,
                            compartment: compartment.name,
                            time_created: i.timeCreated
                        }))
                    });
                    log(`  Found ${instances.length} compute instances`);
                }
            } catch (error) {
                warn(`  Could not list compute instances: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Get VCNs
            try {
                const vcns = await getVCNs(compartment.id);
                if (vcns.length > 0) {
                    resourceSummaries.push({
                        service: 'networking',
                        resourceType: 'vcns',
                        count: vcns.length,
                        resources: vcns.map(v => ({
                            id: v.id,
                            name: v.displayName,
                            cidr_block: v.cidrBlock,
                            lifecycle_state: v.lifecycleState,
                            compartment: compartment.name,
                            time_created: v.timeCreated
                        }))
                    });
                    log(`  Found ${vcns.length} VCNs`);
                }
            } catch (error) {
                warn(`  Could not list VCNs: ${error instanceof Error ? error.message : String(error)}`);
            }
            
            // Get buckets
            const buckets = await getBuckets(compartment.id);
            if (buckets.length > 0) {
                resourceSummaries.push({
                    service: 'object_storage',
                    resourceType: 'buckets',
                    count: buckets.length,
                    resources: buckets.map(b => ({
                        name: b.name,
                        namespace: b.namespace,
                        compartment: compartment.name,
                        time_created: b.timeCreated,
                        etag: b.etag
                    }))
                });
                log(`  Found ${buckets.length} object storage buckets`);
            }
            
            // Get DB systems
            const dbSystems = await getDBSystems(compartment.id);
            if (dbSystems.length > 0) {
                resourceSummaries.push({
                    service: 'database',
                    resourceType: 'db_systems',
                    count: dbSystems.length,
                    resources: dbSystems.map(d => ({
                        id: d.id,
                        name: d.displayName,
                        lifecycle_state: d.lifecycleState,
                        database_edition: d.databaseEdition,
                        shape: d.shape,
                        availability_domain: d.availabilityDomain,
                        compartment: compartment.name,
                        time_created: d.timeCreated
                    }))
                });
                log(`  Found ${dbSystems.length} DB systems`);
            }
            
            // Get Autonomous Databases (ATP/ADW)
            const autonomousDatabases = await getAutonomousDatabases(compartment.id);
            if (autonomousDatabases.length > 0) {
                resourceSummaries.push({
                    service: 'database',
                    resourceType: 'autonomous_databases',
                    count: autonomousDatabases.length,
                    resources: autonomousDatabases.map(d => ({
                        id: d.id,
                        name: d.displayName || d.dbName,
                        db_name: d.dbName,
                        workload_type: d.dbWorkload,
                        lifecycle_state: d.lifecycleState,
                        cpu_core_count: d.cpuCoreCount,
                        data_storage_size_in_tbs: d.dataStorageSizeInTBs,
                        is_auto_scaling_enabled: d.isAutoScalingEnabled,
                        compartment: compartment.name,
                        time_created: d.timeCreated
                    }))
                });
                log(`  Found ${autonomousDatabases.length} Autonomous Databases`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error discovering resources:', error instanceof Error ? error.message : String(error));
    }
    
    return resourceSummaries;
}

// Main function to test the provider and discover resources
async function main() {
    try {
        log('OCI Resource Discovery');
        log(`Config: ${configurationFilePath}`);
        log(`Profile: ${profile}`);
        
        const tenantId = await provider.getTenantId();
        log(`Connected to tenancy: ${tenantId}`);
        log('\n' + '='.repeat(60));
        log('DISCOVERING ALL RESOURCES');
        log('='.repeat(60));
        
        const resourceSummaries = await discoverAllResources();
        
        log('\n' + '='.repeat(60));
        log('RESOURCE SUMMARY');
        log('='.repeat(60));
        
        if (resourceSummaries.length === 0) {
            console.log('resources: []');
            console.log('total_count: 0');
        } else {
            // Create YAML structure
            const yamlOutput = {
                tenancy_id: tenantId,
                profile: profile,
                discovery_time: new Date().toISOString(),
                resources: {} as Record<string, any>,
                summary: {
                    total_count: 0,
                    by_service: {} as Record<string, number>
                }
            };
            
            // Group by service and resource type
            resourceSummaries.forEach(summary => {
                if (!yamlOutput.resources[summary.service]) {
                    yamlOutput.resources[summary.service] = {};
                }
                yamlOutput.resources[summary.service][summary.resourceType] = summary.resources;
                
                // Update summary
                yamlOutput.summary.total_count += summary.count;
                if (!yamlOutput.summary.by_service[summary.service]) {
                    yamlOutput.summary.by_service[summary.service] = 0;
                }
                yamlOutput.summary.by_service[summary.service] += summary.count;
            });
            
            // Output YAML
            console.log(formatYaml(yamlOutput).trimEnd());
        }
        
    } catch (error) {
        console.error('error:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    main();
}
