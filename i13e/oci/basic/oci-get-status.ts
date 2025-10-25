import { identity, database, core, objectstorage } from "oci-sdk"
import * as yaml from "js-yaml"

import { getArgs } from "./args"
import { getProvider } from "./provider"

type Status = {
    tenantId: string,
    region: string,

    //Summary
    summary: {
        totalCompartments: number,
        totalUsers: number,
        totalGroups: number,
        totalPolicies: number,
        totalDbSystems: number,
        totalAutonomousDatabases: number,
        totalComputeInstances: number,
        totalBlockVolumes: number,
        totalVcns: number,
        totalSubnets: number,
        totalSecurityLists: number,
        totalInternetGateways: number,
        totalNatGateways: number,
        totalServiceGateways: number,
        totalBuckets: number
    },

    //Compartments
    compartments: identity.models.Compartment[],

    // Identity Management
    users: identity.models.User[],
    groups: identity.models.Group[],
    policies: identity.models.Policy[],

    // Database
    dbSystems: database.models.DbSystemSummary[],
    autonomousDatabases: database.models.AutonomousDatabaseSummary[],

    // Compute
    computeInstances: core.models.Instance[],
    blockVolumes: core.models.Volume[],

    // Networking
    vcns: core.models.Vcn[],
    subnets: core.models.Subnet[],
    securityLists: core.models.SecurityList[],
    internetGateways: core.models.InternetGateway[],
    natGateways: core.models.NatGateway[],
    serviceGateways: core.models.ServiceGateway[],

    // Storage
    buckets: objectstorage.models.BucketSummary[],
}

let status: Status = {
    tenantId: "",
    region: "",

    //Summary
    summary: {
        totalCompartments: 0,
        totalUsers: 0,
        totalGroups: 0,
        totalPolicies: 0,
        totalDbSystems: 0,
        totalAutonomousDatabases: 0,
        totalComputeInstances: 0,
        totalBlockVolumes: 0,
        totalVcns: 0,
        totalSubnets: 0,
        totalSecurityLists: 0,
        totalInternetGateways: 0,
        totalNatGateways: 0,
        totalServiceGateways: 0,
        totalBuckets: 0
    },

    //Compartments
    compartments: [],

    // Identity Management
    users: [],
    groups: [],
    policies: [],

    // Database
    dbSystems: [],
    autonomousDatabases: [],

    // Compute
    computeInstances: [],
    blockVolumes: [],

    // Networking
    vcns: [],
    subnets: [],
    securityLists: [],
    internetGateways: [],
    natGateways: [],
    serviceGateways: [],

    // Storage
    buckets: []
}

const args = getArgs()
const profile = args['p'] || 'DEFAULT';

const authProvider = getProvider(profile);

async function getTenantId(): Promise<string> {
    return await authProvider.getTenantId();
}

async function getRegion(): Promise<string> {
    const region = authProvider.getRegion();
    return region?.regionId || "Region not set";
}

async function getAllCompartmentsFlat(): Promise<identity.models.Compartment[]> {
    const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: authProvider });
    const tenantId = await getTenantId();
    const allCompartments: identity.models.Compartment[] = [];

    const { tenancy } = await identityClient.getTenancy({ tenancyId: tenantId });
    const tenancyTimeCreated = (tenancy as { timeCreated: Date }).timeCreated;

    // Add root compartment (tenancy) first
    const rootCompartment: identity.models.Compartment = {
        id: tenantId,
        name: "root (tenancy)",
        description: "Root compartment (tenancy)",
        compartmentId: tenantId,
        lifecycleState: identity.models.Compartment.LifecycleState.Active,
        timeCreated: tenancyTimeCreated,
        isAccessible: true,
        freeformTags: {},
        definedTags: {}
    };
    allCompartments.push(rootCompartment);

    // Get all compartments in the tenancy (flat list)
    const listCompartmentsRequest: identity.requests.ListCompartmentsRequest = {
        compartmentId: tenantId,
        compartmentIdInSubtree: true, // Get all compartments in the hierarchy
        accessLevel: identity.requests.ListCompartmentsRequest.AccessLevel.Accessible
    };

    const compartmentResponse = await identityClient.listCompartments(listCompartmentsRequest);
    allCompartments.push(...compartmentResponse.items);

    return allCompartments;
}

async function getAllDbSystems(compartmentId: string): Promise<database.models.DbSystemSummary[]> {
    try {
        const databaseClient = new database.DatabaseClient({ authenticationDetailsProvider: authProvider });
        const request: database.requests.ListDbSystemsRequest = { compartmentId };
        const response = await databaseClient.listDbSystems(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list DB systems for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
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

async function getComputeInstances(compartmentId: string): Promise<core.models.Instance[]> {
    try {
        const computeClient = new core.ComputeClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListInstancesRequest = { compartmentId };
        const response = await computeClient.listInstances(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list compute instances for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getVCNs(compartmentId: string): Promise<core.models.Vcn[]> {
    try {
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListVcnsRequest = { compartmentId };
        const response = await networkClient.listVcns(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list VCNs for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getBuckets(compartmentId: string): Promise<objectstorage.models.BucketSummary[]> {
    try {
        const objectStorageClient = new objectstorage.ObjectStorageClient({ authenticationDetailsProvider: authProvider });

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
        console.warn(`Could not list buckets for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getUsers(): Promise<identity.models.User[]> {
    try {
        const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: authProvider });
        const tenantId = await getTenantId();
        const request: identity.requests.ListUsersRequest = { compartmentId: tenantId };
        const response = await identityClient.listUsers(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list users: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getGroups(): Promise<identity.models.Group[]> {
    try {
        const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: authProvider });
        const tenantId = await getTenantId();
        const request: identity.requests.ListGroupsRequest = { compartmentId: tenantId };
        const response = await identityClient.listGroups(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list groups: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getPolicies(compartmentId: string): Promise<identity.models.Policy[]> {
    try {
        const identityClient = new identity.IdentityClient({ authenticationDetailsProvider: authProvider });
        const request: identity.requests.ListPoliciesRequest = { compartmentId };
        const response = await identityClient.listPolicies(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list policies for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getSubnets(compartmentId: string): Promise<core.models.Subnet[]> {
    try {
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListSubnetsRequest = { compartmentId };
        const response = await networkClient.listSubnets(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list subnets for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getSecurityLists(compartmentId: string): Promise<core.models.SecurityList[]> {
    try {
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListSecurityListsRequest = { compartmentId };
        const response = await networkClient.listSecurityLists(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list security lists for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getInternetGateways(compartmentId: string): Promise<core.models.InternetGateway[]> {
    try {
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListInternetGatewaysRequest = { compartmentId };
        const response = await networkClient.listInternetGateways(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list internet gateways for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getNatGateways(compartmentId: string): Promise<core.models.NatGateway[]> {
    try {
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListNatGatewaysRequest = { compartmentId };
        const response = await networkClient.listNatGateways(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list NAT gateways for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getServiceGateways(compartmentId: string): Promise<core.models.ServiceGateway[]> {
    try {
        const networkClient = new core.VirtualNetworkClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListServiceGatewaysRequest = { compartmentId };
        const response = await networkClient.listServiceGateways(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list service gateways for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function getBlockVolumes(compartmentId: string): Promise<core.models.Volume[]> {
    try {
        const blockStorageClient = new core.BlockstorageClient({ authenticationDetailsProvider: authProvider });
        const request: core.requests.ListVolumesRequest = { compartmentId };
        const response = await blockStorageClient.listVolumes(request);
        return response.items;
    } catch (error) {
        console.warn(`Could not list block volumes for compartment ${compartmentId}: ${error instanceof Error ? error.message : String(error)}`);
        return [];
    }
}

async function main() {
    status.tenantId = await getTenantId();
    status.region = await getRegion();
    status.compartments = await getAllCompartmentsFlat();

    // Get identity resources (tenant-level)
    const [usersResult, groupsResult] = await Promise.all([
        getUsers(),
        getGroups()
    ]);
    status.users = usersResult;
    status.groups = groupsResult;

    // Get all compartment-based resources in parallel
    const allDbSystemPromises = status.compartments.map(compartment =>
        getAllDbSystems(compartment.id)
    );

    const allAutonomousDbPromises = status.compartments.map(compartment =>
        getAutonomousDatabases(compartment.id)
    );

    const allComputeInstancePromises = status.compartments.map(compartment =>
        getComputeInstances(compartment.id)
    );

    const allBlockVolumePromises = status.compartments.map(compartment =>
        getBlockVolumes(compartment.id)
    );

    const allVcnPromises = status.compartments.map(compartment =>
        getVCNs(compartment.id)
    );

    const allSubnetPromises = status.compartments.map(compartment =>
        getSubnets(compartment.id)
    );

    const allSecurityListPromises = status.compartments.map(compartment =>
        getSecurityLists(compartment.id)
    );

    const allInternetGatewayPromises = status.compartments.map(compartment =>
        getInternetGateways(compartment.id)
    );

    const allNatGatewayPromises = status.compartments.map(compartment =>
        getNatGateways(compartment.id)
    );

    const allServiceGatewayPromises = status.compartments.map(compartment =>
        getServiceGateways(compartment.id)
    );

    const allPolicyPromises = status.compartments.map(compartment =>
        getPolicies(compartment.id)
    );

    const allBucketPromises = status.compartments.map(compartment =>
        getBuckets(compartment.id)
    );

    const [
        dbSystemResults,
        autonomousDbResults,
        computeResults,
        blockVolumeResults,
        vcnResults,
        subnetResults,
        securityListResults,
        internetGatewayResults,
        natGatewayResults,
        serviceGatewayResults,
        policyResults,
        bucketResults
    ] = await Promise.all([
        Promise.all(allDbSystemPromises),
        Promise.all(allAutonomousDbPromises),
        Promise.all(allComputeInstancePromises),
        Promise.all(allBlockVolumePromises),
        Promise.all(allVcnPromises),
        Promise.all(allSubnetPromises),
        Promise.all(allSecurityListPromises),
        Promise.all(allInternetGatewayPromises),
        Promise.all(allNatGatewayPromises),
        Promise.all(allServiceGatewayPromises),
        Promise.all(allPolicyPromises),
        Promise.all(allBucketPromises)
    ]);

    status.dbSystems = dbSystemResults.flat();
    status.autonomousDatabases = autonomousDbResults.flat();
    status.computeInstances = computeResults.flat();
    status.blockVolumes = blockVolumeResults.flat();
    status.vcns = vcnResults.flat();
    status.subnets = subnetResults.flat();
    status.securityLists = securityListResults.flat();
    status.internetGateways = internetGatewayResults.flat();
    status.natGateways = natGatewayResults.flat();
    status.serviceGateways = serviceGatewayResults.flat();
    status.policies = policyResults.flat();
    status.buckets = bucketResults.flat();

    // Populate summary
    status.summary.totalCompartments = status.compartments.length;
    status.summary.totalUsers = status.users.length;
    status.summary.totalGroups = status.groups.length;
    status.summary.totalPolicies = status.policies.length;
    status.summary.totalDbSystems = status.dbSystems.length;
    status.summary.totalAutonomousDatabases = status.autonomousDatabases.length;
    status.summary.totalComputeInstances = status.computeInstances.length;
    status.summary.totalBlockVolumes = status.blockVolumes.length;
    status.summary.totalVcns = status.vcns.length;
    status.summary.totalSubnets = status.subnets.length;
    status.summary.totalSecurityLists = status.securityLists.length;
    status.summary.totalInternetGateways = status.internetGateways.length;
    status.summary.totalNatGateways = status.natGateways.length;
    status.summary.totalServiceGateways = status.serviceGateways.length;
    status.summary.totalBuckets = status.buckets.length;

    console.log(yaml.dump(status, { lineWidth: 2000 }))
}

if (require.main === module) {

    main();
}

