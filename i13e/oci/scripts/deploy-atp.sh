#!/bin/bash
set -e

# Deploy ATP database using Terraform for Linux/Mac
# This script deploys ATP (Autonomous Transaction Processing) database 
# using Terraform in a containerized environment with OCI CLI.

# Default values
ENVIRONMENT=""
ACTION=""
PROFILE="DEFAULT"
AUTO_APPROVE=false
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
    echo "Usage: $0 -e <environment> -a <action> [-p <profile>] [-y] [-q]"
    echo ""
    echo "Options:"
    echo "  -e, --environment    Target environment (test or prod)"
    echo "  -a, --action         Action to perform (plan, apply, destroy, output, init)"
    echo "  -p, --profile        OCI CLI profile to use (default: DEFAULT)"
    echo "  -y, --auto-approve   Skip interactive approval for terraform apply"
    echo "  -q, --quiet          Suppress verbose output"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 -e test -a plan"
    echo "  $0 -e test -a apply"
    echo "  $0 -e prod -a plan -p PRODUCTION"
    echo "  $0 -e test -a destroy -y"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -a|--action)
            ACTION="$2"
            shift 2
            ;;
        -p|--profile)
            PROFILE="$2"
            shift 2
            ;;
        -y|--auto-approve)
            AUTO_APPROVE=true
            shift
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

if [[ -z "$ACTION" ]]; then
    error "Action is required"
    usage
    exit 1
fi

# Validate environment
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
    error "Environment must be 'test' or 'prod'"
    exit 1
fi

# Validate action
if [[ ! "$ACTION" =~ ^(plan|apply|destroy|output|init)$ ]]; then
    error "Action must be one of: plan, apply, destroy, output, init"
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
    info "To set up OCI credentials:"
    info "1. Create directory: mkdir \".oci\" (in the i13e/oci/ directory)"
    info "2. Create config file: \".oci/config\""
    info "3. Add your OCI credentials to the config file"
    info ""
    info "For detailed setup instructions, see the 'Common setup' section in README.md"
    exit 1
fi

ENV_PATH="terraform/environments/$ENVIRONMENT"
if [[ ! -d "$ENV_PATH" ]]; then
    error "Environment '$ENVIRONMENT' not found at $ENV_PATH"
    exit 1
fi

# Check for sensitive variables file
SENSITIVE_VARS_FILE="$ENV_PATH/terraform.tfvars.local"
if [[ ! -f "$SENSITIVE_VARS_FILE" ]]; then
    warning "Sensitive variables file not found: $SENSITIVE_VARS_FILE"
    info "Create this file with your passwords:"
    echo 'admin_password    = "YourSecurePassword123!"'
    echo 'wallet_password   = "YourWalletPassword123!"'
    
    if [[ "$ACTION" == "apply" || "$ACTION" == "plan" ]]; then
        read -p "Continue without sensitive variables? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            info "Cancelled by user"
            exit 0
        fi
    fi
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

# No need to prepare terraform command as we build it dynamically in the container call

# Confirmation for destructive actions
if [[ "$ACTION" == "destroy" && "$AUTO_APPROVE" != "true" ]]; then
    warning "You are about to DESTROY the $ENVIRONMENT ATP database!"
    read -p "Type 'DELETE' to confirm destruction: " confirmation
    if [[ "$confirmation" != "DELETE" ]]; then
        info "Destruction cancelled"
        exit 0
    fi
fi

if [[ "$ACTION" == "apply" && "$ENVIRONMENT" == "prod" && "$AUTO_APPROVE" != "true" ]]; then
    warning "You are about to deploy to PRODUCTION environment!"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Deployment cancelled"
        exit 0
    fi
fi

# Run terraform in container
info "Running terraform $ACTION for $ENVIRONMENT environment..."
info "Using OCI profile: $PROFILE"

podman run --rm --security-opt label=disable \
    -v "$OCI_DIR:/root/.oci:ro" \
    -v "$CURRENT_DIR/terraform:/terraform" \
    -w "/terraform/environments/$ENVIRONMENT" \
    -e "OCI_CLI_PROFILE=$PROFILE" \
    --entrypoint="" \
    "$IMAGE_NAME" \
    terraform $ACTION $(if [[ "$ACTION" =~ ^(plan|apply|destroy)$ ]] && [[ -f "$SENSITIVE_VARS_FILE" ]]; then echo "-var-file=terraform.tfvars.local"; fi) $(if [[ "$AUTO_APPROVE" == "true" ]] && [[ "$ACTION" =~ ^(apply|destroy)$ ]]; then echo "-auto-approve"; fi)

if [[ $? -eq 0 ]]; then
    success "Terraform $ACTION completed successfully"
    
    if [[ "$ACTION" == "apply" ]]; then
        info "Getting deployment outputs..."
        podman run --rm --security-opt label=disable \
            -v "$OCI_DIR:/root/.oci:ro" \
            -v "$CURRENT_DIR/terraform:/terraform" \
            -w "/terraform/environments/$ENVIRONMENT" \
            -e "OCI_CLI_PROFILE=$PROFILE" \
            --entrypoint="" \
            "$IMAGE_NAME" \
            terraform output
    fi
else
    error "Terraform $ACTION failed"
    exit 1
fi