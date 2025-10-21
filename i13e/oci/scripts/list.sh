#!/bin/bash
#
# List OCI resources using containerized OCI CLI (YAML output)
#
# Usage: ./list.sh [PROFILE] [QUIET]
#   PROFILE - OCI config profile (default: DEFAULT)
#   QUIET   - Suppress build messages: true|false (default: false)

set -e

PROFILE="${1:-DEFAULT}"
QUIET="${2:-false}"

# Check prerequisites
if ! command -v podman &> /dev/null; then
    echo "Error: Podman is not installed" >&2
    exit 1
fi

# Check for OCI configuration directory (use local .oci directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
OCI_DIR="$PROJECT_DIR/.oci"

if [ ! -d "$OCI_DIR" ] || [ ! -f "$OCI_DIR/config" ]; then
    echo "Error: OCI config not found at $OCI_DIR" >&2
    echo "" >&2
    echo "To set up OCI credentials:" >&2
    echo "1. Create directory: mkdir \".oci\" (in the i13e/oci/ directory)" >&2
    echo "2. Create config file: \".oci/config\"" >&2
    echo "3. Add your OCI credentials to the config file" >&2
    echo "" >&2
    echo "For detailed setup instructions, see the 'Common setup' section in README.md" >&2
    exit 1
fi

# Build image if needed and run
IMAGE_NAME="oci-cli:latest"
if ! podman images --format "{{.Repository}}:{{.Tag}}" | grep -q "^oci-cli:latest$"; then
    if [[ "$QUIET" != "true" ]]; then
        echo "Building OCI CLI image..." >&2
    fi
    podman build -t $IMAGE_NAME . >/dev/null 2>&1
fi

podman run --rm --security-opt label=disable -v "${OCI_DIR}:/root/.oci:ro" $IMAGE_NAME $PROFILE $QUIET
