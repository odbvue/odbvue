import { identity, database, core, objectstorage } from "oci-sdk"
import * as yaml from "js-yaml"
import * as readline from 'readline'
import { mkdirSync, writeFileSync, createWriteStream } from 'fs';
import { dirname } from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

import { getArgs } from "./args"
import { getProvider } from "./provider"
import { getConfig, type ODBVueConfig } from "./config"

const args = getArgs()
const profile = args['p'] || 'DEFAULT';

const authProvider = getProvider(profile);

async function promptForConfirmation(message: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            rl.close();
            resolve(answer.trim() === 'DELETE');
        });
    });
}

async function getAutonomousDatabases(compartmentId: string): Promise<database.models.AutonomousDatabaseSummary[]> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: authProvider });
        const request: database.requests.ListAutonomousDatabasesRequest = { compartmentId };
        const response = await databaseClient.listAutonomousDatabases(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list Autonomous Databases for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function createAdb(config: ODBVueConfig): Promise<void> {
    const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: authProvider });

    const createRequest: database.requests.CreateAutonomousDatabaseRequest = {
            createAutonomousDatabaseDetails: {
                source: "NONE" as any,
                compartmentId: config.compartmentId!,
                dbName: config.autonomousDatabase.dbName,
                displayName: config.autonomousDatabase.displayName,
                adminPassword: config.autonomousDatabase.adminPassword,
                cpuCoreCount: config.autonomousDatabase.cpuCoreCount,
                dataStorageSizeInTBs: config.autonomousDatabase.dataStorageSizeInTbs,
                dbWorkload: config.autonomousDatabase.dbWorkload as any,
                isFreeTier: config.autonomousDatabase.isFreeTier,
                isAutoScalingEnabled: config.autonomousDatabase.isAutoScalingEnabled,
                licenseModel: config.autonomousDatabase.licenseModel as any,
                whitelistedIps: config.autonomousDatabase.whitelistedIps
            }
    };

    await databaseClient.createAutonomousDatabase(createRequest);
}

async function destroyAdb(id: string): Promise<void> {
    const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: authProvider });

    const deleteRequest: database.requests.DeleteAutonomousDatabaseRequest = {
        autonomousDatabaseId: id
    };

    await databaseClient.deleteAutonomousDatabase(deleteRequest);
}

async function downloadWallet(atpId: string, walletFilePath: string, password: string): Promise<void> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: authProvider });
        
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
        
    } catch (error) {
        throw new Error(`Failed to download wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function main() {
    const action = args['a'] || 'plan';
    const config: ODBVueConfig = await getConfig(args['w'] || '');

    if (!config.compartmentId) {
        const tenancyId = await authProvider.getTenantId();
        config.compartmentId = tenancyId;
    }

    const databasesFull = await getAutonomousDatabases(config.compartmentId);
    const databases = databasesFull.map(db => ({
        dbName: db.dbName,
        displayName: db.displayName,
        id: db.id,
        lifecycleState: db.lifecycleState
    }));
    const database = databases.find((db) => db.dbName === config.autonomousDatabase.dbName);

    if (action === 'list') {
        console.log(yaml.dump(databases, {lineWidth: 2000 }));
        return;
    }

    if (action === 'plan') {
        if (database) {
            console.warn(yaml.dump({warning: 'Database already exists', database}, {lineWidth: 2000 }));
        } else {
            console.log(`Autonomous Database ${config.autonomousDatabase.dbName} does not exist and will be created.`);
        }
        return;
    }

    if (action === 'apply') {
        if (database) {
            console.log(yaml.dump({info: 'Database already exists', database}, {lineWidth: 2000 }));
        } else {
            console.log(`Creating Autonomous Database: ${config.autonomousDatabase.dbName}...`);
            await createAdb(config);
            console.log(`Autonomous Database creation initiated successfully.`);
        }
        return
    }

    if (action === 'destroy') {
        if (database) {
            console.log(`\nWARNING: You are about to PERMANENTLY DELETE the following Autonomous Database:`);
            console.log(yaml.dump({
                dbName: database.dbName,
                displayName: database.displayName,
                id: database.id,
                lifecycleState: database.lifecycleState
            }, { lineWidth: 2000 }));
            
            const confirmed = await promptForConfirmation(
                `\nTo confirm deletion, type exactly "DELETE" (without quotes): `
            );
            
            if (confirmed) {
                console.log(`\nDeleting Autonomous Database: ${database.dbName}...`);
                await destroyAdb(database.id);
                console.log(`Database deletion initiated successfully.`);
            } else {
                console.log(`\nDeletion cancelled. You must type exactly "DELETE" to confirm.`);
                process.exit(1);
            }
        } else {
            console.warn(yaml.dump({warning: 'Database does not exist', config}, {lineWidth: 2000 }));
        }
        return;
    }

    if (action === 'wallet') {
        await downloadWallet(database!.id, args['o'] || '', config.autonomousDatabase.walletPassword!);
        console.log(`Wallet downloaded successfully to ${args['o']}`);
        return;
    }
}

if (require.main === module) {
    main();
}

