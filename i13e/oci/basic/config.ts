import * as yaml from "js-yaml"
import { promises as fs } from 'fs'

export interface IngressRule {
    protocol: string;
    source: string;
    source_port_range_min: number | null;
    source_port_range_max: number | null;
    destination_port_range_min: number;
    destination_port_range_max: number;
    description: string;
}

export interface SecurityConfig {
    security_list_display_name: string;
    ingress_rules: IngressRule[];
}

export interface NetworkConfig {
    vcn_display_name: string;
    vcn_cidr_block: string;
    subnet_display_name: string;
    subnet_cidr_block: string;
    internet_gateway_display_name: string;
}

export interface ShapeConfig {
    ocpus: number;
    memory_in_gbs: number;
}

export interface ComputeConfig {
    display_name: string;
    shape: string;
    shape_config: ShapeConfig;
    availability_domain: string;
    image_id: string;
    boot_volume_size_in_gbs: number;
}

export interface AutonomousDatabaseConfig {
    dbName: string;
    displayName: string;
    adminPassword: string;
    walletPassword: string;
    cpuCoreCount: number;
    dataStorageSizeInTbs: number;
    dbWorkload: "OLTP" | "DW" | "AJD" | "APEX";
    isFreeTier: boolean;
    isAutoScalingEnabled: boolean;
    licenseModel: "LICENSE_INCLUDED" | "BRING_YOUR_OWN_LICENSE";
    whitelistedIps?: string[];
}

export interface ODBVueConfig {
    compartmentId?: string;
    autonomousDatabase: AutonomousDatabaseConfig;
    compute: ComputeConfig;
    network: NetworkConfig;
    security: SecurityConfig;
}

export async function getConfig(filePath: string): Promise<ODBVueConfig> {
    
    if (!filePath) {
        throw new Error('Workspace file path (-w) is required');
    }

    const fileContents = await fs.readFile(filePath, 'utf8');
    const config = yaml.load(fileContents) as ODBVueConfig;
    
    // Validate required properties
    if (!config.autonomousDatabase) {
        throw new Error('autonomousDatabase configuration is required');
    }
    if (!config.compute) {
        throw new Error('compute configuration is required');
    }
    if (!config.network) {
        throw new Error('network configuration is required');
    }
    if (!config.security) {
        throw new Error('security configuration is required');
    }
    
    return config;
}
