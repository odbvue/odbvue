#!/bin/bash
#
# setup.sh - Unified nginx setup script (local or remote via SSH)
#
# Orchestrates nginx setup by reading configuration and templates from local files.
# Works in two modes:
#   1. Local execution: sets up nginx on current machine
#   2. Remote execution: copies files to remote and executes there
#
# Usage:
#   bash setup.sh                                    # Local setup
#   bash setup.sh <remote-host> [ssh-key]           # Remote setup
#
# Examples:
#   bash setup.sh
#   bash setup.sh ubuntu@123.45.67.89
#   bash setup.sh ubuntu@123.45.67.89 ~/.ssh/odbvue
#

set -euo pipefail

# ============================================================================
# COLORS & LOGGING
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    # Use printf to avoid interpreting backslashes in messages (e.g., Windows paths)
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

# ============================================================================
# SETUP FUNCTIONS
# ============================================================================

get_script_dir() {
    cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

check_deps() {
    log_info "Checking dependencies..."
    
    for cmd in yq nginx sudo; do
        if ! command -v "$cmd" &> /dev/null; then
            log_error "$cmd is not installed"
            exit 1
        fi
    done
    
    log_success "Dependencies OK"
}

check_local_files() {
    log_info "Checking required files..."
    
    local script_dir=$(get_script_dir)
    
    if [[ ! -f "$script_dir/sites.yaml" ]]; then
        log_error "sites.yaml not found in $script_dir"
        exit 1
    fi
    
    if [[ ! -f "$script_dir/nginx.conf.tpl" ]]; then
        log_error "nginx.conf.tpl not found in $script_dir"
        exit 1
    fi
    
    if [[ ! -f "$script_dir/site.conf.tpl" ]]; then
        log_error "site.conf.tpl not found in $script_dir"
        exit 1
    fi
    
    log_success "All required files found"
}

install_yq() {
    log_info "Installing yq..."
    
    # Detect OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
    else
        log_error "Cannot detect OS"
        exit 1
    fi
    
    case "$OS" in
        ubuntu|debian)
            sudo apt-get update -qq
            sudo apt-get install -y yq
            ;;
        rhel|centos|rocky|fedora|ol)
            if ! sudo yum install -y yq 2>/dev/null; then
                log_warn "yq not in yum repository, downloading binary..."
                install_yq_binary
            fi
            ;;
        *)
            log_warn "Unsupported OS: $OS, attempting binary installation..."
            install_yq_binary
            ;;
    esac
    
    if command -v yq &> /dev/null; then
        log_success "yq installed successfully"
    else
        log_error "Failed to install yq"
        exit 1
    fi
}

install_yq_binary() {
    log_info "Downloading yq binary..."
    
    local arch=$(uname -m)
    case "$arch" in
        x86_64) arch="amd64" ;;
        aarch64) arch="arm64" ;;
    esac
    
    local os=$(uname -s | tr '[:upper:]' '[:lower:]')
    local yq_url="https://github.com/mikefarah/yq/releases/latest/download/yq_${os}_${arch}"
    local temp_dir=$(mktemp -d)
    local temp_yq="$temp_dir/yq"
    
    if curl -fsSL -o "$temp_yq" "$yq_url" 2>/dev/null; then
        sudo mv "$temp_yq" /usr/local/bin/yq
        sudo chmod +x /usr/local/bin/yq
        rm -rf "$temp_dir"
        log_success "Downloaded yq from GitHub releases"
    else
        log_error "Failed to download yq binary"
        rm -rf "$temp_dir"
        exit 1
    fi
}

cleanup_old_sites() {
    log_info "Cleaning up sites no longer in config..."
    
    local sites_yaml="$1"
    local current_sites=$(yq -r '.sites[].site_name' "$sites_yaml" | sort)
    
    if [[ -d /var/www ]]; then
        for existing_dir in /var/www/*/; do
            existing_site=$(basename "$existing_dir")
            if echo "$current_sites" | grep -q "^${existing_site}$"; then
                continue
            fi
            log_warn "Removing old site: $existing_site"
            sudo rm -rf "$existing_dir"
        done
    fi
}

clear_slots() {
    log_info "Clearing existing blue/green slots..."
    
    local sites_yaml="$1"
    local sites=$(yq -r '.sites[].site_name' "$sites_yaml")
    
    for site in $sites; do
        local base_dir="/var/www/$site"
        for slot in blue green; do
            if [[ -d "$base_dir/$slot" ]]; then
                sudo rm -rf "$base_dir/$slot"/*
                log_success "Cleared $base_dir/$slot"
            fi
        done
    done
}

setup_directories() {
    log_info "Setting up directories..."
    
    local sites_yaml="$1"
    local sites=$(yq -r '.sites[].site_name' "$sites_yaml")
    
    for site in $sites; do
        local base_dir="/var/www/$site"
        
        sudo mkdir -p "$base_dir"
        sudo chmod 755 "$base_dir"
        
        for slot in blue green; do
            sudo mkdir -p "$base_dir/$slot"
            sudo chown nginx:nginx "$base_dir/$slot"
            sudo chmod 755 "$base_dir/$slot"
            log_success "Created $base_dir/$slot"
        done
        
        sudo chown nginx:nginx "$base_dir"
        sudo chmod 755 "$base_dir"
        
        if [[ ! -L "$base_dir/current" ]]; then
            sudo ln -s "$base_dir/blue" "$base_dir/current"
            sudo chown -h nginx:nginx "$base_dir/current"
            log_success "Created symlink: $base_dir/current -> blue"
        else
            # Ensure symlink owner is nginx (important for nginx to follow it)
            sudo chown -h nginx:nginx "$base_dir/current" 2>/dev/null || true
        fi
    done
    
    sudo chown nginx:nginx /var/www
    sudo chmod 755 /var/www
    
    if command -v restorecon &> /dev/null; then
        log_info "Restoring SELinux contexts..."
        sudo restorecon -Rv /var/www/ 2>/dev/null || true
        log_success "SELinux contexts restored"
    fi
}

copy_ssl_certs() {
    log_info "Checking SSL certificates..."
    
    sudo mkdir -p /etc/ssl/certs /etc/ssl/private
    
    if [[ ! -f /etc/ssl/certs/odbvue.crt ]] || [[ ! -f /etc/ssl/private/odbvue.key ]]; then
        log_warn "SSL certificates not found. Please copy them to:"
        log_warn "  - /etc/ssl/certs/odbvue.crt"
        log_warn "  - /etc/ssl/private/odbvue.key"
        return 0
    fi
    
    sudo chmod 644 /etc/ssl/certs/odbvue.crt
    sudo chmod 600 /etc/ssl/private/odbvue.key
    log_success "SSL certificates verified"
}

generate_nginx_config() {
    log_info "Generating nginx.conf..."
    
    local sites_config=""
    local sites=$(yq -r '.sites[].site_name' "$1")
    
    for site in $sites; do
        local domain=$(yq -r ".sites[] | select(.site_name==\"$site\") | .domain" "$1")
        local site_conf=$(cat "$2")
        site_conf="${site_conf//%%SERVER_NAME%%/$domain}"
        site_conf="${site_conf//%%SITE_NAME%%/$site}"
        sites_config+="$site_conf"$'\n'
    done
    
    local temp_conf=$(mktemp)
    local temp_sites=$(mktemp)
    
    # Write sites_config to a temporary file to avoid escaping issues
    echo "$sites_config" > "$temp_sites"
    
    # Use sed to replace placeholder with contents of temp file
    sed "/%%SITES_CONFIG%%/{
        r $temp_sites
        d
    }" "$3" > "$temp_conf"
    
    rm "$temp_sites"
    
    if ! sudo nginx -t -c "$temp_conf" 2>/dev/null; then
        log_error "nginx configuration validation failed"
        rm "$temp_conf"
        return 1
    fi
    
    sudo cp "$temp_conf" /etc/nginx/nginx.conf
    sudo chown root:root /etc/nginx/nginx.conf
    sudo chmod 644 /etc/nginx/nginx.conf
    
    rm "$temp_conf"
    log_success "Generated: /etc/nginx/nginx.conf"
}

validate_config() {
    log_info "Validating nginx configuration..."
    
    if sudo nginx -t; then
        log_success "nginx configuration is valid"
    else
        log_error "nginx configuration validation failed"
        return 1
    fi
}

reload_nginx() {
    log_info "Reloading nginx..."
    
    if sudo systemctl reload nginx; then
        log_success "nginx reloaded successfully"
    else
        log_error "Failed to reload nginx"
        return 1
    fi
}

# ============================================================================
# REMOTE EXECUTION
# ============================================================================

resolve_ssh_key_path() {
    local ssh_key="$1"
    local use_windows_ssh="${2:-false}"
    
    # If empty, return empty
    [[ -z "$ssh_key" ]] && echo "" && return 0
    
    # Expand ~ to $HOME
    ssh_key="${ssh_key/#\~/$HOME}"

    # Helper: convert POSIX path to Windows path for Windows OpenSSH
    posix_to_windows() {
        local path="$1"
        if [[ "$path" == /mnt/[a-zA-Z]/* ]]; then
            # Convert /mnt/c/Users/... to C:\Users\...
            local drive=$(echo "$path" | sed -E 's|^/mnt/([a-zA-Z])/.*|\1|' | tr 'a-z' 'A-Z')
            local rest=$(echo "$path" | sed -E 's|^/mnt/[a-zA-Z](/.+)$|\1|' | tr '/' '\\')
            echo "${drive}:${rest}"
        else
            echo "$path"
        fi
    }
    
    # If caller passed a Windows-style path (e.g., C:\Users\...), check for it
    if [[ "$ssh_key" =~ ^[A-Za-z]:[\\/] ]]; then
        # Verify existence by converting to POSIX path
        local drive_lower=$(echo "$ssh_key" | sed -E 's/^([A-Za-z]).*/\1/' | tr 'A-Z' 'a-z')
        local rest_path=$(echo "$ssh_key" | sed -E 's/^[A-Za-z]:(.*)/\1/' | tr '\\' '/')
        local posix_check="/mnt/${drive_lower}${rest_path}"
        if [[ -f "$posix_check" ]]; then
            echo "$ssh_key"
            return 0
        fi
    fi
    
    # If POSIX path, check if it exists; convert if using Windows OpenSSH
    if [[ -f "$ssh_key" ]]; then
        if [[ "$use_windows_ssh" == "true" && "$ssh_key" == /mnt/[a-zA-Z]/* ]]; then
            posix_to_windows "$ssh_key"
        else
            echo "$ssh_key"
        fi
        return 0
    fi
    
    # If we're in WSL and the path doesn't exist, try to find it in Windows user directories
    if [[ ! -f "$ssh_key" && -d /mnt/c/Users ]]; then
        local keyname=$(basename "$ssh_key")
        
        for windows_user_dir in /mnt/c/Users/*/; do
            local potential_key="$windows_user_dir.ssh/$keyname"
            if [[ -f "$potential_key" ]]; then
                if [[ "$use_windows_ssh" == "true" ]]; then
                    posix_to_windows "$potential_key"
                else
                    echo "$potential_key"
                fi
                return 0
            fi
        done
    fi
    
    # If still not found, return the original path and let ssh fail with better error
    echo "$ssh_key"
}

run_remote() {
    local remote_host="$1"
    local ssh_key="${2:-}"
    
    # Find ssh command - check multiple locations for Windows compatibility
    local ssh_cmd="ssh"
    local scp_cmd="scp"
    local use_windows_ssh=false
    
    if ! command -v ssh &> /dev/null; then
        if [[ -f "/mnt/c/WINDOWS/System32/OpenSSH/ssh.exe" ]]; then
            ssh_cmd="/mnt/c/WINDOWS/System32/OpenSSH/ssh.exe"
            scp_cmd="/mnt/c/WINDOWS/System32/OpenSSH/scp.exe"
            use_windows_ssh=true
            log_info "Using Windows OpenSSH: $ssh_cmd"
        else
            log_error "ssh command not found in PATH or Windows OpenSSH location"
            exit 1
        fi
    fi
    
    # Resolve SSH key path for Windows/WSL compatibility
    if [[ -n "$ssh_key" ]]; then
        ssh_key=$(resolve_ssh_key_path "$ssh_key" "$use_windows_ssh")
    fi
    
    log_info "Starting remote nginx setup..."
    log_info "Host: $remote_host"
    if [[ -n "$ssh_key" ]]; then
        log_info "SSH Key: $ssh_key"
    fi
    echo ""
    
    local script_dir=$(get_script_dir)
    
    # When using Windows OpenSSH, convert script_dir from POSIX to Windows path
    if [[ "$use_windows_ssh" == "true" && "$script_dir" == /mnt/[a-zA-Z]/* ]]; then
        local drive=$(echo "$script_dir" | sed -E 's|/mnt/([a-zA-Z])/.*|\1|' | tr 'a-z' 'A-Z')
        local rest=$(echo "$script_dir" | sed -E 's|/mnt/[a-zA-Z](.*)|\1|' | tr '/' '\\')
        script_dir="${drive}:${rest}"
    fi
    
    # Build ssh/scp commands as arrays to preserve argument boundaries (no embedded quotes)
    local ssh_a=("$ssh_cmd")
    local scp_a=("$scp_cmd")
    if [[ -n "$ssh_key" ]]; then
        ssh_a+=("-i" "$ssh_key")
        scp_a+=("-i" "$ssh_key")
    fi
    
    # Create temporary directory on remote
    local remote_tmp="/tmp/nginxsetup-$$"
    log_info "Creating temporary directory on remote: $remote_tmp"
    "${ssh_a[@]}" "$remote_host" "mkdir -p $remote_tmp"
    
    # Copy files to remote
    log_info "Copying files to remote..."
    "${scp_a[@]}" -q "$script_dir/setup.sh" "$remote_host:$remote_tmp/"
    "${scp_a[@]}" -q "$script_dir/sites.yaml" "$remote_host:$remote_tmp/"
    "${scp_a[@]}" -q "$script_dir/nginx.conf.tpl" "$remote_host:$remote_tmp/"
    "${scp_a[@]}" -q "$script_dir/site.conf.tpl" "$remote_host:$remote_tmp/"
    log_success "Files copied successfully"
    echo ""
    
    # Execute setup.sh on remote
    log_info "Executing setup on remote machine..."
    echo ""
    "${ssh_a[@]}" "$remote_host" "cd $remote_tmp && bash setup.sh"
    
    if [[ $? -eq 0 ]]; then
        log_success "Remote execution completed successfully!"
        
        # Cleanup
        log_info "Cleaning up temporary files..."
    "${ssh_a[@]}" "$remote_host" "rm -rf $remote_tmp"
        log_success "Cleanup completed"
        
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "  1. Deploy content: bash remote-deploy.sh $remote_host [$ssh_key]"
        # Compose a friendly command hint
        local hint_cmd="$ssh_cmd"
        if [[ -n "$ssh_key" ]]; then
            hint_cmd+=" -i $ssh_key"
        fi
        echo "  2. Check status: $hint_cmd $remote_host 'sudo systemctl status nginx'"
        echo "  3. View logs: $hint_cmd $remote_host 'sudo tail -f /var/log/nginx/access.log'"
    else
        log_error "Remote execution failed"
        log_info "Temporary files left at: $remote_tmp (for debugging)"
        echo "You can manually clean up with:"
        local hint_cmd_fail="$ssh_cmd"
        if [[ -n "$ssh_key" ]]; then
            hint_cmd_fail+=" -i $ssh_key"
        fi
        echo "  $hint_cmd_fail $remote_host 'rm -rf $remote_tmp'"
        exit 1
    fi
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    local remote_host="${1:-}"
    local ssh_key="${2:-}"
    
    # If remote host provided, execute remotely
    if [[ -n "$remote_host" ]]; then
        run_remote "$remote_host" "$ssh_key"
        exit 0
    fi
    
    # Otherwise, run locally
    log_info "Starting local nginx setup..."
    echo ""
    
    local script_dir=$(get_script_dir)
    local sites_yaml="$script_dir/sites.yaml"
    local nginx_conf_tpl="$script_dir/nginx.conf.tpl"
    local site_conf_tpl="$script_dir/site.conf.tpl"
    
    check_local_files
    check_deps
    cleanup_old_sites "$sites_yaml"
    clear_slots "$sites_yaml"
    setup_directories "$sites_yaml"
    copy_ssl_certs
    generate_nginx_config "$sites_yaml" "$site_conf_tpl" "$nginx_conf_tpl"
    validate_config
    reload_nginx
    
    echo ""
    log_success "nginx setup completed successfully!"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "  1. Deploy content: bash remote-deploy.sh <remote-host> [ssh-key]"
    echo "  2. Check status: ssh <remote-host> 'sudo systemctl status nginx'"
    echo "  3. View logs: ssh <remote-host> 'sudo tail -f /var/log/nginx/access.log'"
}

main "$@"
