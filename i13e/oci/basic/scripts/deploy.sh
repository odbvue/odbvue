#!/bin/bash
# bash deploy.sh # Deploy all sites

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    printf "%bℹ%b %s\n" "$BLUE" "$NC" "$1"
}

log_success() {
    printf "%b✓%b %s\n" "$GREEN" "$NC" "$1"
}

log_warn() {
    printf "%b⚠%b %s\n" "$YELLOW" "$NC" "$1"
}

log_error() {
    printf "%b✗%b %s\n" "$RED" "$NC" "$1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

check_local_files() {
    if [ ! -f "$SCRIPT_DIR/sites.yaml" ]; then
        log_error "sites.yaml not found in $SCRIPT_DIR"
        exit 1
    fi
}

check_deps() {
    if ! command -v python3 &>/dev/null; then
        log_error "python3 is not installed"
        exit 1
    fi
    
    if ! command -v nginx &>/dev/null; then
        log_error "nginx is not installed"
        exit 1
    fi
}

parse_sites() {
    python3 - "$SCRIPT_DIR/sites.yaml" << 'PYTHON_EOF'
import sys, yaml
with open(sys.argv[1]) as f:
    config = yaml.safe_load(f)
for site in config.get('sites', []):
    print(f"{site['siteName']}|{site['remotePath']}")
PYTHON_EOF
}

get_active_slot() {
    local site=$1
    local current_link="/var/www/$site/current"
    
    if [[ ! -L "$current_link" ]]; then
        log_warn "Symlink not found for $site, assuming 'blue' is active"
        echo "blue"
        return
    fi
    
    local target=$(readlink "$current_link")
    
    if [[ "$target" == *"/blue" ]]; then
        echo "blue"
    elif [[ "$target" == *"/green" ]]; then
        echo "green"
    else
        log_warn "Unknown symlink target for $site: $target, assuming 'blue'"
        echo "blue"
    fi
}

get_inactive_slot() {
    local active=$1
    if [[ "$active" == "blue" ]]; then
        echo "green"
    else
        echo "blue"
    fi
}

deploy_site() {
    local siteName=$1
    local remotePath=$2
    
    log_info "=== Deploying $siteName ==="
    
    # Resolve relative paths from script directory
    local localPath=$SCRIPT_DIR/$siteName/
    
    # Check if source exists
    if [[ ! -d "$localPath" ]]; then
        log_error "Local path does not exist: $localPath"
        return 1
    fi
    
    if [[ -z "$(ls -A "$localPath" 2>/dev/null)" ]]; then
        log_error "Local path is empty: $localPath"
        return 1
    fi
    
    # Determine active and inactive slots
    local active_slot=$(get_active_slot "$siteName")
    local inactive_slot=$(get_inactive_slot "$active_slot")
    
    log_info "  Current active slot: $active_slot"
    log_info "  Deploying to slot: $inactive_slot"
    log_info "  Source: $localPath"
    log_info "  Target base: $remotePath"
    
    local target_dir="$remotePath$inactive_slot"
    
    # Clear target slot
    log_info "Clearing target directory..."
    sudo rm -rf "$target_dir"/*
    
    # Copy files
    log_info "Copying files..."
    if ! sudo cp -r "$localPath"/* "$target_dir/" 2>/dev/null; then
        log_error "Failed to copy files to $target_dir"
        return 1
    fi
    
    # Set permissions
    log_info "Setting permissions..."
    sudo find "$target_dir" -type d -exec chmod 755 {} \;
    sudo find "$target_dir" -type f -exec chmod 644 {} \;
    sudo chown -R nginx:nginx "$target_dir"
    
    # Handle SELinux if present
    if command -v restorecon &> /dev/null; then
        sudo restorecon -Rv "$target_dir" 2>/dev/null || true
    fi
    
    # Flip symlink (atomic swap)
    log_info "Flipping symlink..."
    local current_link="$remotePath/current"
    local new_target="$remotePath$inactive_slot"
    local temp_link="${current_link}.tmp"
    
    sudo ln -sf "$new_target" "$temp_link"
    sudo mv -T "$temp_link" "$current_link"
    sudo chown -h nginx:nginx "$current_link"
    
    log_success "Deployed $siteName to $inactive_slot"
    echo ""
}

reload_nginx() {
    log_info "Validating nginx configuration..."
    
    if ! sudo nginx -t 2>&1 | grep -q "successful"; then
        log_error "nginx validation failed"
        return 1
    fi
    
    log_info "Reloading nginx..."
    if sudo systemctl reload nginx; then
        log_success "nginx reloaded successfully"
    else
        log_error "Failed to reload nginx"
        return 1
    fi
}

main() {
    log_info "Starting deployment..."
    echo ""
    
    check_local_files
    check_deps
    
    while IFS='|' read -r siteName remotePath; do
        deploy_site "$siteName" "$remotePath" || true
    done < <(parse_sites)

    reload_nginx

    log_info "Deployment completed."
    echo ""
}

main "$@"
