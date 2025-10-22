#!/usr/bin/env tsx

import { ConfigFileAuthenticationDetailsProvider, core, identity, limits } from 'oci-sdk';
import { homedir } from 'os';
import { join } from 'path';

interface Args {
  configFile?: string;
  profile?: string;
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
            case '-h':
            case '--help':
                console.log('Usage: tsx check-availability.ts [-c config-file] [-p profile]');
                console.log('  -c, --config     Path to OCI config file');
                console.log('  -p, --profile    Profile name to use');
                console.log('');
                console.log('This script checks:');
                console.log('  • Available domains in your region');
                console.log('  • Available compute shapes and their capacity');
                console.log('  • Compatible OS images for different shapes');
                console.log('  • Resource limits and availability');
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

const provider = new ConfigFileAuthenticationDetailsProvider(
    configurationFilePath,
    profile
);

async function checkAvailability() {
    try {
        console.log('🔍 OCI Resource Availability Check');
        console.log(`Config: ${configurationFilePath}`);
        console.log(`Profile: ${profile}`);
        
        const tenantId = await provider.getTenantId();
        console.log(`Tenancy: ${tenantId}`);
        console.log('\n' + '='.repeat(80));
        
        const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: provider });
        const computeClient = new core.ComputeClient({ authenticationDetailsProvider: provider });

        // Get Availability Domains
        const adsResponse = await identityClient.listAvailabilityDomains({
            compartmentId: tenantId
        });
        
        // Get available shapes
        const shapesToCheck = [
            { name: 'VM.Standard.A1.Flex', type: 'ARM', ocpus: 1, memory: 6, description: 'ARM-based Ampere, usually more available' },
            { name: 'VM.Standard.E4.Flex', type: 'x86', ocpus: 1, memory: 16, description: 'x86-64 Intel/AMD, high performance' },
            { name: 'VM.Standard.E3.Flex', type: 'x86', ocpus: 1, memory: 16, description: 'x86-64 AMD EPYC, good fallback' },
            { name: 'VM.Standard2.1', type: 'x86', ocpus: 1, memory: 15, description: 'Fixed shape, Intel Skylake' }
        ];

        // Check images for ARM and x86
        const imageChecks = [
            { shape: 'VM.Standard.A1.Flex', type: 'ARM' },
            { shape: 'VM.Standard.E4.Flex', type: 'x86' },
            { shape: 'VM.Standard.E3.Flex', type: 'x86' },
            { shape: 'VM.Standard2.1', type: 'x86' }
        ];

        const availableConfigs: any[] = [];

        for (const shapeInfo of shapesToCheck) {
            try {
                const shapesResponse = await computeClient.listShapes({
                    compartmentId: tenantId,
                    availabilityDomain: adsResponse.items[0]?.name!
                });
                
                const shape = shapesResponse.items.find(s => s.shape === shapeInfo.name);
                if (shape) {
                    // Get compatible images
                    const imageCheck = imageChecks.find(ic => ic.shape === shapeInfo.name);
                    if (imageCheck) {
                        try {
                            const imagesResponse = await computeClient.listImages({
                                compartmentId: tenantId,
                                operatingSystem: 'Oracle Linux',
                                operatingSystemVersion: '8',
                                shape: imageCheck.shape,
                                sortBy: 'TIMECREATED' as any,
                                sortOrder: 'DESC' as any,
                                limit: 1
                            });

                            if (imagesResponse.items.length > 0) {
                                const latestImage = imagesResponse.items[0];
                                availableConfigs.push({
                                    shape: shapeInfo,
                                    availabilityDomain: adsResponse.items[0]?.name,
                                    image: latestImage,
                                    available: true
                                });
                            }
                        } catch (imageError) {
                            // Skip if no images found
                        }
                    } else {
                        // For shapes without specific image check
                        availableConfigs.push({
                            shape: shapeInfo,
                            availabilityDomain: adsResponse.items[0]?.name,
                            image: null,
                            available: true
                        });
                    }
                }
            } catch (error) {
                // Shape not available
            }
        }

        // Output clean YAML configurations
        console.log('📋 COPY-PASTABLE YAML CONFIGURATIONS');
        console.log('='.repeat(80));

        availableConfigs.forEach((config, index) => {
            const shape = config.shape;
            const isFlexShape = shape.name.includes('.Flex');
            
            console.log(`\n${index + 1}. ${shape.name} (${shape.type}) - ${shape.description}`);
            console.log('─'.repeat(60));
            
            if (config.image) {
                console.log('# Compute configuration:');
                console.log('compute:');
                console.log(`  display_name: "web-server"`);
                console.log(`  shape: "${shape.name}"  # ${shape.description}`);
                
                if (isFlexShape) {
                    console.log('  shape_config:');
                    console.log(`    ocpus: ${shape.ocpus}`);
                    console.log(`    memory_in_gbs: ${shape.memory}  # ${shape.type} shape memory ratio`);
                }
                
                console.log(`  availability_domain: "${config.availabilityDomain}"`);
                console.log(`  image_id: "${config.image.id}"  # ${config.image.displayName}`);
                console.log('  boot_volume_size_in_gbs: 50');
            } else {
                console.log('# Basic compute configuration (no specific image found):');
                console.log('compute:');
                console.log(`  display_name: "web-server"`);
                console.log(`  shape: "${shape.name}"  # ${shape.description}`);
                
                if (isFlexShape) {
                    console.log('  shape_config:');
                    console.log(`    ocpus: ${shape.ocpus}`);
                    console.log(`    memory_in_gbs: ${shape.memory}`);
                }
                
                console.log(`  availability_domain: "${config.availabilityDomain}"`);
                console.log('  image_id: "REPLACE_WITH_COMPATIBLE_IMAGE_ID"');
                console.log('  boot_volume_size_in_gbs: 50');
            }
        });

        // Summary and recommendations
        console.log('\n\n📊 SUMMARY & RECOMMENDATIONS');
        console.log('=' .repeat(80));
        
        const armConfigs = availableConfigs.filter(c => c.shape.type === 'ARM');
        const x86Configs = availableConfigs.filter(c => c.shape.type === 'x86');
        
        console.log(`\n✅ Found ${availableConfigs.length} available compute configurations:`);
        console.log(`   • ${armConfigs.length} ARM-based shapes (typically better availability)`);
        console.log(`   • ${x86Configs.length} x86-based shapes (broader software compatibility)`);
        
        if (armConfigs.length > 0) {
            console.log(`\n🎯 RECOMMENDED (Best Availability): ${armConfigs[0].shape.name}`);
            console.log('   Copy configuration #1 above for optimal deployment success');
        }
        
        if (x86Configs.length > 0) {
            const x86Index = availableConfigs.findIndex(c => c.shape.type === 'x86') + 1;
            console.log(`\n🔄 FALLBACK (Software Compatibility): ${x86Configs[0].shape.name}`);
            console.log(`   Copy configuration #${x86Index} above if ARM deployment fails`);
        }
        
        console.log('\n📝 Deployment Strategy:');
        console.log('   1. Copy recommended configuration to your web-odbvue.yaml');
        console.log('   2. Run: pnpm deploy-web -c ./.oci/config -p ODBVUE -f ./workspace/web-odbvue.yaml -a apply');
        console.log('   3. If "Out of host capacity" error occurs, try fallback configuration');
        console.log('   4. Consider deploying during off-peak hours for better availability');

    } catch (error) {
        console.error('\n❌ Error during availability check:', error instanceof Error ? error.message : String(error));
        
        if (error instanceof Error) {
            if (error.message.includes('NotAuthorizedOrNotFound')) {
                console.log('\n💡 Tip: Check your OCI permissions and compartment ID');
            } else if (error.message.includes('profile')) {
                console.log('\n💡 Tip: Check your OCI config file and profile name');
            }
        }
        
        process.exit(1);
    }
}

// Run the availability check
if (require.main === module) {
    checkAvailability();
}