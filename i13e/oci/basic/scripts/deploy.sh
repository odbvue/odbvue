#!/bin/bash
#
# deploy.sh - Unified blue/green deployment script (local or remote via SSH)
#
# Orchestrates blue/green deployments by reading configuration from local files.
# Works in two modes:
#   1. Local execution: deploys on current machine
#   2. Remote execution: copies files to remote and executes there
#
# Usage:
#   bash deploy.sh [options]                         # Local deployment
#   bash deploy.sh <remote-host> [ssh-key] [options] # Remote deployment
#
# Options:
#   --validate     Only validate nginx config
#   --rollback     Rollback to previous deployment
#   --dry-run      Show what would happen without making changes
#   <site>         Deploy specific site (default: all sites)
#
# Examples:
#   bash deploy.sh                                    # Deploy all sites locally
#   bash deploy.sh --dry-run                          # Test locally (no changes)
#   bash deploy.sh ubuntu@123.45.67.89                # Deploy all sites on remote
#   bash deploy.sh ubuntu@123.45.67.89~/.ssh/odbvue --rollback  # Rollback on remote
#   bash deploy.sh apps                               # Deploy 'apps' site locally
#   bash deploy.sh ubuntu@123.45.67.89 ~/.ssh/odbvue apps      # Deploy 'apps' on remote
#

set -euo pipefail

# ============================================================================
# COLORS & LOGGING
# ============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# ============================================================================
# SETUP FUNCTIONS
# ============================================================================

get_script_dir() {
    cd "$(dirname "${BASH_SOURCE[0]}")" && pwd
}

check_local_files() {
    log_info "Checking required files..."
    
    local script_dir=$(get_script_dir)
    local posix_script_dir="$script_dir"
    
    if [[ ! -f "$script_dir/sites.yaml" ]]; then
        log_error "sites.yaml not found in $script_dir"
        exit 1
    fi
    
    log_success "All required files found"
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

# ============================================================================
# DEPLOYMENT FUNCTIONS
# ============================================================================

get_sites() {
    local sites_yaml="$1"
    local target_site="${2:-}"
    
    if [[ -z "$target_site" ]]; then
        yq -r '.sites[].site_name' "$sites_yaml"
    else
        echo "$target_site"
    fi
}

get_active_slot() {
    local site=$1
    local current_link="/var/www/$site/current"
    
    if [[ ! -L "$current_link" ]]; then
        echo "blue"
        return
    fi
    
    local target=$(readlink "$current_link")
    
    if [[ "$target" == *"/blue" ]]; then
        echo "blue"
    elif [[ "$target" == *"/green" ]]; then
        echo "green"
    else
        echo "unknown"
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

deploy_content() {
    local site=$1
    local target_slot=$2
    local sites_yaml=$3
    local dry_run=${4:-false}
    
    local remote_path=$(yq -r ".sites[] | select(.site_name==\"$site\") | .remote_path" "$sites_yaml")
    local local_path=$(yq -r ".sites[] | select(.site_name==\"$site\") | .local_path" "$sites_yaml")
    
    if [[ "$remote_path" == "null" ]] || [[ "$local_path" == "null" ]]; then
        log_error "Site $site not found in sites.yaml"
        return 1
    fi
    
    local_path="${local_path/#\.\//$(dirname "$sites_yaml")/}"
    
    if [[ ! -d "$local_path" ]]; then
        log_warn "Local path does not exist: $local_path (skipping content deploy)"
        return 0
    fi
    
    local target_dir="/var/www/$site/$target_slot"
    
    log_info "Deploying $site to $target_slot..."
    log_info "  Source: $local_path"
    log_info "  Target: $target_dir"
    
    if [[ "$dry_run" == true ]]; then
        log_warn "DRY RUN - would deploy to $target_dir"
        return 0
    fi
    
    sudo mkdir -p "$target_dir"
    sudo rm -rf "$target_dir"/*
    
    if [[ -d "$local_path" ]] && [[ -n "$(ls -A "$local_path" 2>/dev/null)" ]]; then
        sudo cp -r "$local_path"/* "$target_dir/" 2>/dev/null || true
        sudo find "$target_dir" -type d -exec chmod 755 {} \;
        sudo find "$target_dir" -type f -exec chmod 644 {} \;
        sudo chown -R nginx:nginx "$target_dir"
        sudo chmod 755 "/var/www/$site"
        sudo chmod 755 "/var/www"
        if command -v restorecon &> /dev/null; then
            sudo restorecon -Rv "$target_dir" 2>/dev/null || true
        fi
        log_success "Deployed $site to $target_slot"
    else
        log_warn "Source directory empty or not accessible: $local_path"
        return 0
    fi
}

validate_deployment() {
    local site=$1
    local target_slot=$2
    
    log_info "Validating deployment for $site ($target_slot)..."
    
    local target_dir="/var/www/$site/$target_slot"
    
    if [[ ! -d "$target_dir" ]]; then
        log_error "Target directory does not exist: $target_dir"
        return 1
    fi
    
    if [[ ! -f "$target_dir/index.html" ]]; then
        log_error "index.html not found in $target_dir"
        return 1
    fi
    
    log_success "Validation passed for $site"
}

run_smoke_tests() {
    local site=$1
    local target_slot=$2
    
    log_info "Running smoke tests for $site..."
    
    local target_dir="/var/www/$site/$target_slot"
    
    if [[ ! -f "$target_dir/index.html" ]]; then
        log_warn "No index.html found in $target_dir"
        return 1
    fi
    
    log_success "Smoke test passed for $site"
}

flip_symlink() {
    local site=$1
    local active_slot=$2
    local inactive_slot=$3
    local dry_run=${4:-false}
    
    local current_link="/var/www/$site/current"
    local new_target="/var/www/$site/$inactive_slot"
    
    log_info "Flipping symlink for $site: $active_slot -> $inactive_slot"
    
    if [[ "$dry_run" == true ]]; then
        log_warn "DRY RUN - would flip symlink to $inactive_slot"
        return 0
    fi
    
    local temp_link="${current_link}.tmp"
    sudo ln -sf "$new_target" "$temp_link"
    sudo mv -T "$temp_link" "$current_link"
    # Ensure symlink owner is nginx (important for nginx to follow it)
    sudo chown -h nginx:nginx "$current_link"
    
    log_success "Symlink flipped to $inactive_slot"
}

rollback() {
    local site=$1
    local dry_run=${2:-false}
    
    log_info "Rolling back $site..."
    
    local active_slot=$(get_active_slot "$site")
    local inactive_slot=$(get_inactive_slot "$active_slot")
    
    log_warn "Rolling back from $active_slot to $inactive_slot"
    
    if [[ "$dry_run" == true ]]; then
        log_warn "DRY RUN - would rollback symlink"
        return 0
    fi
    
    flip_symlink "$site" "$active_slot" "$inactive_slot" "false"
    log_success "Rollback completed for $site"
}

validate_nginx_only() {
    log_info "Validating nginx configuration..."
    
    if sudo nginx -t; then
        log_success "nginx configuration is valid"
    else
        log_error "nginx configuration is invalid"
        exit 1
    fi
}

deploy_site() {
    local site=$1
    local sites_yaml=$2
    local dry_run=${3:-false}
    
    log_info "=== Deploying $site ==="
    
    local active_slot=$(get_active_slot "$site")
    local target_slot=$(get_inactive_slot "$active_slot")
    
    log_info "Active: $active_slot, Target: $target_slot"
    
    if ! deploy_content "$site" "$target_slot" "$sites_yaml" "$dry_run"; then
        log_error "Failed to deploy content for $site"
        return 1
    fi
    
    if ! validate_deployment "$site" "$target_slot"; then
        log_error "Validation failed for $site"
        return 1
    fi
    
    if ! run_smoke_tests "$site" "$target_slot"; then
        log_warn "Smoke tests failed for $site (continuing anyway)"
    fi
    
    flip_symlink "$site" "$active_slot" "$target_slot" "$dry_run"
    
    log_success "Successfully deployed $site"
    echo ""
}

# ============================================================================
# ARGUMENT PARSING
# ============================================================================

parse_args() {
    local remote_host=""
    local ssh_key=""
    local target_site=""
    local validate_only=false
    local rollback_mode=false
    local dry_run=false
    
    # Check if first arg looks like a remote host
    if [[ $# -gt 0 ]] && [[ "$1" =~ "@" ]] && [[ "$1" != "--"* ]]; then
        remote_host="$1"
        shift
        
        # Check if next arg is SSH key (accept any non-option that isn't another host)
        # Accepts formats: ~/.ssh/key, /abs/path, C:\path\to\key, relative path
        if [[ $# -gt 0 ]] && [[ "$1" != "--"* ]] && [[ ! "$1" =~ "@" ]]; then
            ssh_key="$1"
            shift
        fi
    fi
    
    # Parse remaining args
    while [[ $# -gt 0 ]]; do
        case $1 in
            --validate)
                validate_only=true
                shift
                ;;
            --rollback)
                rollback_mode=true
                shift
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            --*)
                log_error "Unknown option: $1"
                exit 1
                ;;
            *)
                target_site="$1"
                shift
                ;;
        esac
    done
    
    echo "$remote_host|$ssh_key|$target_site|$validate_only|$rollback_mode|$dry_run"
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
            local drive=$(echo "$path" | sed -E 's|^/mnt/([a-zA-Z])/.+|\1|' | tr 'a-z' 'A-Z')
            local rest=$(echo "$path" | sed -E 's|^/mnt/[a-zA-Z]/(.+)$|\1|' | tr '/' '\\')
            echo "${drive}:\\${rest}"
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
    local target_site="${3:-}"
    local validate_only="${4:-false}"
    local rollback_mode="${5:-false}"
    local dry_run="${6:-false}"
    
    local script_dir=$(get_script_dir)
    local posix_script_dir="$script_dir"
    
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
    
    log_info "Starting remote deployment..."
    log_info "Host: $remote_host"
    if [[ -n "$ssh_key" ]]; then
        log_info "SSH Key: $ssh_key"
    fi
    echo ""
    
    # When using Windows OpenSSH, convert paths for scp, but keep POSIX for local reads
    local script_dir_scp="$script_dir"
    if [[ "$use_windows_ssh" == "true" && "$script_dir_scp" == /mnt/[a-zA-Z]/* ]]; then
        local drive=$(echo "$script_dir_scp" | sed -E 's|/mnt/([a-zA-Z])/.*|\1|' | tr 'a-z' 'A-Z')
        local rest=$(echo "$script_dir_scp" | sed -E 's|/mnt/[a-zA-Z](.*)|\1|' | tr '/' '\\')
        script_dir_scp="${drive}:${rest}"
    fi
    
    # Build ssh/scp commands as arrays to preserve argument boundaries (no embedded quotes)
    local ssh_a=("$ssh_cmd")
    local scp_a=("$scp_cmd")
    if [[ -n "$ssh_key" ]]; then
        ssh_a+=("-i" "$ssh_key")
        scp_a+=("-i" "$ssh_key")
    fi
    
    # Create temporary directory on remote
    local remote_tmp="/tmp/deployscript-$$"
    log_info "Creating temporary directory on remote: $remote_tmp"
    "${ssh_a[@]}" "$remote_host" "mkdir -p $remote_tmp"
    
    # Prepare content for remote deployment using tar piping
    local local_sites_yaml="$posix_script_dir/sites.yaml"

    # Create content root on remote
    "${ssh_a[@]}" "$remote_host" "mkdir -p $remote_tmp/content"

    # Copy script and original sites.yaml to remote first
    log_info "Copying files to remote..."
    "${scp_a[@]}" -q "$script_dir_scp/deploy.sh" "$remote_host:$remote_tmp/"
    "${scp_a[@]}" -q "$script_dir_scp/sites.yaml" "$remote_host:$remote_tmp/"

    # Parse sites.yaml to collect all sites and their local paths
    declare -A site_local_paths
    local current_site=""
    
    while IFS= read -r line; do
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*site_name:[[:space:]]*\"([^\"]+)\" ]]; then
            current_site="${BASH_REMATCH[1]}"
            site_local_paths["$current_site"]=""
        elif [[ -n "$current_site" && "$line" =~ ^[[:space:]]*local_path:[[:space:]]*\"?([^\"]+)\"? ]]; then
            site_local_paths["$current_site"]="${BASH_REMATCH[1]}"
        fi
    done < "$local_sites_yaml"
    
    log_info "Copying site content to remote..."
    
    # Copy each site's content using tar via ssh pipe
    for site in "${!site_local_paths[@]}"; do
        local raw_local_path="${site_local_paths[$site]}"
        
        # Resolve to absolute POSIX path on local machine
        local abs_local_path="$posix_script_dir/$raw_local_path"

        # Canonicalize POSIX path if it exists
        if [[ -d "$abs_local_path" ]]; then
            abs_local_path="$(cd "$abs_local_path" && pwd)"
        else
            log_warn "Local path does not exist: $abs_local_path (will skip copying for $site)"
            continue
        fi
        
        # Copy site content to remote using tar via ssh
        log_info "  - Copying $site..."
        (cd "$abs_local_path" && tar -cf - .) | "${ssh_a[@]}" "$remote_host" "mkdir -p $remote_tmp/content/$site && cd $remote_tmp/content/$site && tar -xf -"
    done
    
    # Create patched sites.yaml content and send via ssh heredoc
    log_info "Updating sites.yaml on remote..."
    {
        cat <<'EOF'
# Sites (paths updated for remote deployment)
sites:
EOF
        while IFS= read -r line; do
            if [[ "$line" =~ ^sites: ]]; then
                # Skip the original "sites:" line, we already wrote it
                continue
            elif [[ "$line" =~ ^[[:space:]]*-[[:space:]]*site_name:[[:space:]]*\"([^\"]+)\" ]]; then
                local site="${BASH_REMATCH[1]}"
                echo "$line"
                # Now output remaining fields until local_path
                while IFS= read -r next_line; do
                    if [[ "$next_line" =~ ^[[:space:]]*local_path: ]]; then
                        # Replace with new path pointing to extracted location
                        echo "    local_path: \"$remote_tmp/content/$site\""
                        break
                    else
                        echo "$next_line"
                    fi
                done
            else
                echo "$line"
            fi
        done < "$local_sites_yaml"
    } | "${ssh_a[@]}" "$remote_host" "cat > $remote_tmp/sites.yaml"

    log_success "Files copied successfully"
    echo ""
    
    # Build deploy args
    local deploy_args=""
    [[ "$validate_only" == true ]] && deploy_args+=" --validate"
    [[ "$rollback_mode" == true ]] && deploy_args+=" --rollback"
    [[ "$dry_run" == true ]] && deploy_args+=" --dry-run"
    [[ -n "$target_site" ]] && deploy_args+=" $target_site"
    
    # Execute deploy.sh on remote
    log_info "Executing deployment on remote machine..."
    echo ""
    "${ssh_a[@]}" "$remote_host" "cd $remote_tmp && bash deploy.sh$deploy_args"
    
    local result=$?
    
    echo ""
    
    if [[ $result -eq 0 ]]; then
        log_success "Remote deployment completed successfully!"
        
        # Cleanup
        log_info "Cleaning up temporary files..."
        "${ssh_a[@]}" "$remote_host" "rm -rf $remote_tmp"
        log_success "Cleanup completed"
        
        echo ""
        echo -e "${BLUE}Next steps:${NC}"
        echo "  1. Check nginx: ${ssh_cmd} -i ${ssh_key:-<key>} $remote_host 'sudo systemctl status nginx'"
        echo "  2. View access logs: ${ssh_cmd} -i ${ssh_key:-<key>} $remote_host 'sudo tail -f /var/log/nginx/access.log'"
        echo "  3. Rollback (if needed): bash deploy.sh $remote_host [$ssh_key] --rollback"
    else
        log_error "Remote deployment failed with exit code $result"
        log_info "Temporary files left at: $remote_tmp (for debugging)"
        echo "You can manually clean up with:"
        echo "  ${ssh_cmd} -i ${ssh_key:-<key>} $remote_host 'rm -rf $remote_tmp'"
        exit 1
    fi
}

# ============================================================================
# MAIN
# ============================================================================

main() {
    local args_parsed=$(parse_args "$@")
    ( IFS='|' read -r remote_host ssh_key target_site validate_only rollback_mode dry_run <<< "$args_parsed" )
    local remote_host=$(echo "$args_parsed" | cut -d'|' -f1)
    local ssh_key=$(echo "$args_parsed" | cut -d'|' -f2)
    local target_site=$(echo "$args_parsed" | cut -d'|' -f3)
    local validate_only=$(echo "$args_parsed" | cut -d'|' -f4)
    local rollback_mode=$(echo "$args_parsed" | cut -d'|' -f5)
    local dry_run=$(echo "$args_parsed" | cut -d'|' -f6)
    
    # Remote execution
    if [[ -n "$remote_host" ]]; then
        run_remote "$remote_host" "$ssh_key" "$target_site" "$validate_only" "$rollback_mode" "$dry_run"
        exit 0
    fi
    
    # Local execution
    if [[ "$validate_only" == true ]]; then
        validate_nginx_only
        exit 0
    fi
    
    log_info "Starting local deployment..."
    echo ""
    
    local script_dir=$(get_script_dir)
    local sites_yaml="$script_dir/sites.yaml"
    
    check_local_files
    check_deps
    
    if [[ "$rollback_mode" == true ]]; then
        local sites=$(get_sites "$sites_yaml" "$target_site")
        for site in $sites; do
            rollback "$site" "$dry_run" || true
        done
        log_success "Rollback completed"
        exit 0
    fi
    
    # Normal deployment
    local sites=$(get_sites "$sites_yaml" "$target_site")
    local success_count=0
    local fail_count=0
    local site_count=0
    
    # Reset IFS to ensure for loop works correctly with newlines
    IFS=$'\n'
    
    for site in $sites; do
        site_count=$((site_count + 1))
        if deploy_site "$site" "$sites_yaml" "$dry_run" 2>&1; then
            ((success_count++)) || true
        else
            ((fail_count++)) || true
        fi
    done
    
    echo ""
    log_info "Deployment Summary:"
    log_success "Successful: $success_count"
    
    if [[ $fail_count -gt 0 ]]; then
        log_error "Failed: $fail_count"
        exit 1
    else
        log_success "All deployments completed successfully!"
    fi
    
    if [[ "$dry_run" != true ]]; then
        log_info "Reloading nginx..."
        sudo systemctl reload nginx
        log_success "nginx reloaded"
    fi
}

main "$@"
