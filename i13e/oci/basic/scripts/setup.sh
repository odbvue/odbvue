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
SITES="{}"

check_local_files() {
if [ ! -f "$SCRIPT_DIR/sites.yaml" ]; then
    log_error "sites.yaml not found next to script ($SCRIPT_DIR)"
    exit 1
fi
if [ ! -f "$SCRIPT_DIR/nginx.conf.tpl" ]; then
    log_error "nginx.conf.tpl not found next to script ($SCRIPT_DIR)"
    exit 1
fi
if [ ! -f "$SCRIPT_DIR/nginx.site.conf.tpl" ]; then
    log_error "nginx.site.conf.tpl not found next to script ($SCRIPT_DIR)"
    exit 1
fi
if [[ ! -d "$SCRIPT_DIR/.ssl" ]]; then
    log_error "SSL directory not found at $SCRIPT_DIR/.ssl"
    exit 1
fi
}

check_deps() {
    if ! command -v python3 &>/dev/null; then
        log_error "python3 is not installed"
        exit 1
    fi
}

get_sites() {
    SITES=$(python3 - "$SCRIPT_DIR/sites.yaml" << 'PYTHON_EOF'
import sys, yaml
with open(sys.argv[1]) as f:
    config = yaml.safe_load(f)
for site in config.get('sites', []):
    print(f"{site['siteName']}|{site['domainName']}")
PYTHON_EOF
    )
}

remove_existing_directories() {
     while IFS='|' read -r siteName domainName; do
        if [ -n "$siteName" ]; then
            local base_dir="/var/www/$siteName"

            log_warn "Removing site directory: $base_dir"
            sudo rm -rf "$base_dir"
        fi
    done <<< "$SITES"
}

create_new_directories() {
    while IFS='|' read -r siteName domainName; do
        if [ -n "$siteName" ]; then
            local base_dir="/var/www/$siteName"

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
        fi
    done <<< "$SITES"

    
    sudo chown nginx:nginx /var/www
    sudo chmod 755 /var/www
    
    if command -v restorecon &> /dev/null; then
        log_info "Restoring SELinux contexts..."
        sudo restorecon -Rv /var/www/ 2>/dev/null || true
        log_success "SELinux contexts restored"
    fi
}

copy_ssl_certs() {
    log_info "Setting up SSL certificates..."
    
    # Find first .crt and .txt files in .ssl directory
    local cert_file=$(find "$SCRIPT_DIR/.ssl" -maxdepth 1 -name "*.crt" -type f | head -1)
    local key_file=$(find "$SCRIPT_DIR/.ssl" -maxdepth 1 -name "*.txt" -type f | head -1)
    
    if [[ -z "$cert_file" ]]; then
        log_error "No .crt certificate file found in $SCRIPT_DIR/.ssl"
        exit 1
    fi
    
    if [[ -z "$key_file" ]]; then
        log_error "No .txt private key file found in $SCRIPT_DIR/.ssl"
        exit 1
    fi
    
    log_info "Found certificate: $cert_file"
    log_info "Found private key: $key_file"
    
    log_warn "Removing existing SSL directories..."
    sudo rm -rf /etc/ssl/certs /etc/ssl/private
    
    log_info "Creating SSL directories..."
    sudo mkdir -p /etc/ssl/certs /etc/ssl/private
    
    log_info "Copying SSL certificates..."
    sudo cp "$cert_file" /etc/ssl/certs/odbvue.crt
    sudo cp "$key_file" /etc/ssl/private/odbvue.key

    log_info "Setting certificate permissions..."
    sudo chmod 644 /etc/ssl/certs/odbvue.crt
    sudo chmod 600 /etc/ssl/private/odbvue.key
    
    log_success "SSL certificates configured"
}

generate_nginx_config() {
    log_info "Generating nginx.conf..."

    local nginx_conf_tpl="$SCRIPT_DIR/nginx.conf.tpl"
    local nginx_site_conf_tpl="$SCRIPT_DIR/nginx.site.conf.tpl"

    local sites_config=""
    while IFS='|' read -r siteName domainName; do
        local site_conf=$(cat "$nginx_site_conf_tpl")
        site_conf="${site_conf//%%SERVER_NAME%%/$domainName}"
        site_conf="${site_conf//%%SITE_NAME%%/$siteName}"
        sites_config+="$site_conf"$'\n'
    done <<< "$SITES"

    local temp_conf=$(mktemp)
    local temp_sites=$(mktemp)
    
    echo "$sites_config" > "$temp_sites"
    sed "/%%SITES_CONFIG%%/{
        r $temp_sites
        d
    }" "$nginx_conf_tpl" > "$temp_conf"
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

deploy_sample_site() {
    log_info "Deploying sample site to each site's blue slot..."
    
    while IFS='|' read -r siteName domainName; do
        local blue_dir="/var/www/$siteName/blue"
        
        if [ -d "$blue_dir" ]; then
            echo "<html><head><title>Welcome to $siteName</title></head><body><h1>Welcome, $siteName!</h1></body></html>" | sudo tee "$blue_dir/index.html" >/dev/null
            sudo chown nginx:nginx "$blue_dir/index.html"
            sudo chmod 644 "$blue_dir/index.html"
            log_success "Deployed sample site to $blue_dir"
        else
            log_error "Blue directory not found for site $siteName at $blue_dir"
        fi
    done <<< "$SITES"
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

main() {
    log_info "Setting up Web server..."

    check_local_files
    check_deps
    get_sites
    remove_existing_directories
    create_new_directories
    copy_ssl_certs
    generate_nginx_config
    validate_config
    deploy_sample_site
    reload_nginx
}

sudo dnf install -y python3-pyyaml

main "$@"
