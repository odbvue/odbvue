#!/bin/bash
set -e

PROFILE="${1:-DEFAULT}"
QUIET="${2:-false}"

# Color output (only for errors)
RED='\033[0;31m'
NC='\033[0m'

print_error() {
    echo -e "${RED}✗ $1${NC}" >&2
}

# Suppress file permissions warning
export OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True

# Get the root tenancy ID from the config file
if [ ! -f "/root/.oci/config" ]; then
    print_error "OCI config file not found at /root/.oci/config"
    exit 1
fi

COMPARTMENT_ID=$(grep "^tenancy=" /root/.oci/config | head -1 | cut -d'=' -f2 | tr -d '\r\n')

if [ -z "$COMPARTMENT_ID" ]; then
    print_error "Failed to get compartment ID from config"
    exit 1
fi

# Function to get resource data in JSON format
get_resource_data() {
    local service=$1
    local command=$2
    local resource_name=$3
    
    local result=$(oci $service $command --compartment-id "$COMPARTMENT_ID" --all --profile "$PROFILE" --output json 2>/dev/null || echo '{"data": []}')
    echo "$result"
}

# Function to get count safely
get_count() {
    local data=$1
    local count=$(echo "$data" | jq '.data | length' 2>/dev/null)
    if [[ "$count" =~ ^[0-9]+$ ]]; then
        echo "$count"
    else
        echo "0"
    fi
}

echo "oci_resources:"
echo "  tenancy_id: \"$COMPARTMENT_ID\""
echo "  profile: \"$PROFILE\""
echo "  region: \"$(grep "^region=" /root/.oci/config | head -1 | cut -d'=' -f2 | tr -d '\r\n')\""
echo "  timestamp: \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
echo "  resources:"

# Get all resources in JSON and convert to YAML-like format
echo "    compute_instances:"
instances=$(get_resource_data "compute" "instance list" "instances")
instance_count=$(get_count "$instances")
echo "      count: $instance_count"
if [[ $instance_count -gt 0 ]]; then
    echo "      items:"
    echo "$instances" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\"\n          shape: \"" + (.shape // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    autonomous_databases:"
adbs=$(get_resource_data "db" "autonomous-database list" "databases")
adb_count=$(get_count "$adbs")
echo "      count: $adb_count"
if [[ $adb_count -gt 0 ]]; then
    echo "      items:"
    echo "$adbs" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\"\n          db_name: \"" + (.["db-name"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    vcns:"
vcns=$(get_resource_data "network" "vcn list" "vcns")
vcn_count=$(get_count "$vcns")
echo "      count: $vcn_count"
if [[ $vcn_count -gt 0 ]]; then
    echo "      items:"
    echo "$vcns" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          cidr: \"" + (.["cidr-block"] // "N/A") + "\"\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    subnets:"
subnets=$(get_resource_data "network" "subnet list" "subnets")
subnet_count=$(get_count "$subnets")
echo "      count: $subnet_count"
if [[ $subnet_count -gt 0 ]]; then
    echo "      items:"
    echo "$subnets" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          cidr: \"" + (.["cidr-block"] // "N/A") + "\"\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    block_volumes:"
volumes=$(get_resource_data "bv" "volume list" "volumes")
volume_count=$(get_count "$volumes")
echo "      count: $volume_count"
if [[ $volume_count -gt 0 ]]; then
    echo "      items:"
    echo "$volumes" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          size_gb: " + (.["size-in-gbs"] // 0 | tostring) + "\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    boot_volumes:"
boot_volumes=$(get_resource_data "bv" "boot-volume list" "boot-volumes")
boot_volume_count=$(get_count "$boot_volumes")
echo "      count: $boot_volume_count"
if [[ $boot_volume_count -gt 0 ]]; then
    echo "      items:"
    echo "$boot_volumes" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          size_gb: " + (.["size-in-gbs"] // 0 | tostring) + "\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    object_storage_buckets:"
buckets=$(get_resource_data "os" "bucket list" "buckets")
bucket_count=$(get_count "$buckets")
echo "      count: $bucket_count"
if [[ $bucket_count -gt 0 ]]; then
    echo "      items:"
    echo "$buckets" | jq -r '.data[] | "        - name: \"" + (.name // "N/A") + "\"\n          namespace: \"" + (.namespace // "N/A") + "\"\n          created: \"" + (.["time-created"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi

echo "    load_balancers:"
lbs=$(get_resource_data "lb" "load-balancer list" "load-balancers")
lb_count=$(get_count "$lbs")
echo "      count: $lb_count"
if [[ $lb_count -gt 0 ]]; then
    echo "      items:"
    echo "$lbs" | jq -r '.data[] | "        - name: \"" + (.["display-name"] // "N/A") + "\"\n          id: \"" + .id + "\"\n          state: \"" + (.["lifecycle-state"] // "N/A") + "\""' 2>/dev/null || echo "        - error: \"Failed to parse data\""
fi
