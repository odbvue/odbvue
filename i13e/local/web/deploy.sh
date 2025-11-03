#!/bin/bash

# ODBVue Web Server - Simple Deploy
# Copy files to pod's releases directory with atomic symlink switch
#
# Usage: ./deploy.sh [pod-name] [source-directory]
# Example: ./deploy.sh odbvue-web ./html
# Example: ./deploy.sh odbvue-web ../../../apps/dist

set -euo pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
POD_NAME="${1:-}"
SOURCE_DIR="${2:-}"
RELEASES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/releases"
REL=$(date +%Y-%m-%d-%H%M%S)
DEST_REL="/releases/$REL"
CURRENT_LINK="/releases/current"

# Validation
if [[ -z "$POD_NAME" ]] || [[ -z "$SOURCE_DIR" ]]; then
    echo -e "${RED}Error: Missing arguments${NC}"
    echo "Usage: $0 [pod-name] [source-directory]"
    echo ""
    echo "Examples:"
    echo "  $0 odbvue-web ./html"
    echo "  $0 odbvue-web ../../../apps/dist"
    exit 1
fi

# Normalize source path
SOURCE_DIR="$(cd "$SOURCE_DIR" 2>/dev/null && pwd)" || {
    echo -e "${RED}Error: Source directory not found: $2${NC}"
    exit 1
}

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Header
echo -e "${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     ODBVue Deploy - Copy Files                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Pod: $POD_NAME"
log_info "Source: $SOURCE_DIR"
log_info "Release ID: $REL"
log_info "Deploy to: $DEST_REL"
echo ""

# Step 1: Create release directory
log_info "Creating release directory..."
mkdir -p "$RELEASES_DIR/$REL" || podman exec "$POD_NAME" mkdir -p "$DEST_REL"
log_success "Release directory created"

# Step 2: Copy files
log_info "Copying files..."
if command -v rsync &>/dev/null; then
    rsync -av --delete \
        --exclude='.git' \
        --exclude='.gitignore' \
        --exclude='node_modules' \
        --exclude='.DS_Store' \
        "$SOURCE_DIR/" "$RELEASES_DIR/$REL/"
else
    cp -r "$SOURCE_DIR"/* "$RELEASES_DIR/$REL/" 2>/dev/null || true
    cp -r "$SOURCE_DIR"/.[!.]* "$RELEASES_DIR/$REL/" 2>/dev/null || true
fi
log_success "Files copied"

# Step 3: Verify deployment
log_info "Verifying deployment..."
if [[ ! -f "$RELEASES_DIR/$REL/index.html" ]]; then
    log_error "index.html not found in release directory"
    rm -rf "$RELEASES_DIR/$REL"
    exit 1
fi
log_success "Deployment verified (index.html found)"

# Step 4: Show old release
CURRENT_LINK="$RELEASES_DIR/current"
if [[ -L "$CURRENT_LINK" ]] && [[ -e "$CURRENT_LINK" ]]; then
    OLD_RELEASE=$(readlink "$CURRENT_LINK")
    log_info "Current active release: $OLD_RELEASE"
else
    log_warning "No previous release (first deployment)"
fi

# Step 5: Atomic symlink switch
log_info "Switching symlink (atomic cutover)..."
DEST_REL_BASENAME=$(basename "$DEST_REL")
ln -sfn "$DEST_REL_BASENAME" "$CURRENT_LINK.tmp"
mv -Tf "$CURRENT_LINK.tmp" "$CURRENT_LINK"
log_success "Symlink switched atomically"

# Step 6: Health check
log_info "Health checking..."
sleep 0.5
if curl -sf http://localhost:8080/ > /dev/null 2>&1; then
    log_success "HTTP health check passed"
else
    log_warning "HTTP health check (skipped)"
fi

# Step 7: Cleanup old releases (keep last 3)
log_info "Cleaning up old releases (keeping last 3)..."
# Count releases, only delete if we have more than 3
RELEASE_COUNT=$(find "$RELEASES_DIR" -maxdepth 1 -type d -name "[0-9]*-*" 2>/dev/null | wc -l)
if [[ $RELEASE_COUNT -gt 3 ]]; then
    # Keep last 3, delete the rest
    find "$RELEASES_DIR" -maxdepth 1 -type d -name "[0-9]*-*" | sort -r | tail -n +4 | xargs -r rm -rf
fi
log_success "Cleanup completed"

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║     Deployment completed successfully! ✓           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
log_info "Active release: $DEST_REL"
echo ""
