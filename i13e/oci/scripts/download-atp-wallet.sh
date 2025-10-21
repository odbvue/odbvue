#!/bin/bash
set -e

# Download ATP wallet using OCI CLI
# This script downloads the wallet directly from OCI using the OCI CLI

# Default values
ENVIRONMENT=""
OUTPUT_PATH="./wallet.zip"
QUIET=false

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info() { 
    if [ "$QUIET" != "true" ]; then 
        echo -e "${CYAN}ℹ️  $1${NC}" 
    fi 
}

success() { 
    echo -e "${GREEN}✅ $1${NC}" 
}

warning() { 
    echo -e "${YELLOW}⚠️  $1${NC}" 
}

error() { 
    echo -e "${RED}❌ $1${NC}" >&2 
}

# Usage function
usage() {
    echo "Usage: $0 -e <environment> [-o <output_path>] [-q]"
    echo ""
    echo "Options:"
    echo "  -e, --environment    Target environment (test or prod)"
    echo "  -o, --output         Output path for wallet file (default: ./wallet.zip)"
    echo "  -q, --quiet          Suppress verbose output"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e test"
    echo "  $0 -e test -o ~/Downloads/odbvue-wallet.zip"
    echo "  $0 -e prod -o /tmp/prod-wallet.zip"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_PATH="$2"
            shift 2
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required parameters
if [[ -z "$ENVIRONMENT" ]]; then
    error "Environment is required"
    usage
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
    error "Environment must be 'test' or 'prod'"
    exit 1
fi

# Check prerequisites
info "Checking prerequisites..."

if ! command -v podman &> /dev/null; then
    error "Podman is not installed"
    exit 1
fi

# Check for OCI configuration directory (use local .oci directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OCI_DIR="$PROJECT_DIR/.oci"

if [[ ! -d "$OCI_DIR" ]] || [[ ! -f "$OCI_DIR/config" ]]; then
    error "OCI config not found at $OCI_DIR"
    exit 1
fi

ENV_PATH="terraform/environments/$ENVIRONMENT"
if [[ ! -d "$ENV_PATH" ]]; then
    error "Environment '$ENVIRONMENT' not found at $ENV_PATH"
    exit 1
fi

# Check if Terraform state exists
STATE_FILE="$ENV_PATH/terraform.tfstate"
if [[ ! -f "$STATE_FILE" ]]; then
    error "Terraform state not found at $STATE_FILE"
    info "Run 'bash ./scripts/deploy-atp.sh -e $ENVIRONMENT -a apply' first"
    exit 1
fi

# Build container image if needed
info "Preparing container environment..."
IMAGE_NAME="oci-terraform:latest"
CURRENT_DIR=$(pwd)

if ! podman images --format "{{.Repository}}:{{.Tag}}" | grep -q "^oci-terraform:latest$"; then
    info "Building OCI Terraform container image..."
    if ! podman build -t "$IMAGE_NAME" . &>/dev/null; then
        error "Failed to build container image"
        exit 1
    fi
fi

# Get ATP database ID from Terraform state
info "Getting database ID from Terraform state..."

ATP_ID=$(podman run --rm --security-opt label=disable \
    -v "$OCI_DIR:/root/.oci:ro" \
    -v "$CURRENT_DIR/terraform:/terraform" \
    -w "/terraform/environments/$ENVIRONMENT" \
    -e "OCI_CLI_PROFILE=DEFAULT" \
    --entrypoint="" \
    "$IMAGE_NAME" \
    terraform output -raw atp_id 2>/dev/null)

if [[ -z "$ATP_ID" ]]; then
    error "Failed to get database ID from Terraform state"
    info "Make sure the database was created successfully"
    exit 1
fi

info "Database ID: $ATP_ID"

# Download wallet using OCI CLI
info "Downloading wallet using OCI CLI..."

# Create output directory if it doesn't exist
OUTPUT_DIR=$(dirname "$OUTPUT_PATH")
mkdir -p "$OUTPUT_DIR"

# Download the wallet directly to the output path
info "Downloading wallet to: $OUTPUT_PATH"

podman run --rm --security-opt label=disable \
    -v "$OCI_DIR:/root/.oci:ro" \
    -v "$CURRENT_DIR:/workspace" \
    -w "/workspace" \
    -e "OCI_CLI_SUPPRESS_FILE_PERMISSIONS_WARNING=True" \
    --entrypoint="" \
    "$IMAGE_NAME" \
    oci db autonomous-database generate-wallet \
    --autonomous-database-id "$ATP_ID" \
    --password "OdbVue2025Wallet#!" \
    --file "/workspace/$(basename "$OUTPUT_PATH")"

# Check if the wallet file was created
if [[ -f "$OUTPUT_PATH" ]]; then
    info "Wallet downloaded successfully"
else
    error "Wallet file was not created"
    exit 1
fi

if [[ $? -eq 0 ]] && [[ -f "$OUTPUT_PATH" ]]; then
    success "Wallet downloaded successfully to: $OUTPUT_PATH"
    
    # Show file info
    FILE_SIZE=$(stat -c%s "$OUTPUT_PATH" 2>/dev/null || stat -f%z "$OUTPUT_PATH" 2>/dev/null || echo "unknown")
    info "Wallet file size: $FILE_SIZE bytes"
    
    # Verify it's a valid zip file
    if command -v file &> /dev/null; then
        FILE_TYPE=$(file "$OUTPUT_PATH")
        info "File type: $FILE_TYPE"
    fi
    
    info ""
    info "Usage instructions:"
    info "1. Extract the wallet zip file to a directory"
    info "2. Set TNS_ADMIN environment variable to the wallet directory"
    info "3. Use the connection strings from 'terraform output atp_connection_strings'"
    info "4. Connect using admin username with password: OdbVue2025Test#DB!"
    
else
    error "Failed to save wallet to $OUTPUT_PATH"
    exit 1
fi