# Nginx Setup & Deployment Scripts

## Overview

Automated scripts for setting up nginx and deploying web content using **blue/green deployments** on local or remote machines.

## Scripts

### `setup.sh` - Nginx Configuration
**What it does:**
- Installs nginx with dependencies (yq)
- Creates directory structure for blue/green deployment
- Generates nginx config from `sites.yaml` template
- Sets up SSL certificates and permissions

**Usage:**
```bash
# Local setup
bash setup.sh

# Remote setup (SSH)
bash setup.sh user@host.com [~/.ssh/key]
```

### `deploy.sh` - Blue/Green Deployment
**What it does:**
- Deploys site content to inactive slot (blue or green)
- Validates deployment and runs smoke tests
- Swaps symlink to activate new version (zero-downtime)
- Supports rollback to previous deployment

**Usage:**
```bash
# Local: deploy all sites
bash deploy.sh

# Remote: deploy all sites
bash deploy.sh user@host.com [~/.ssh/key]

# Deploy specific site
bash deploy.sh [user@host.com] app-name

# Test without changes
bash deploy.sh --dry-run

# Rollback to previous version
bash deploy.sh [user@host.com] --rollback

# Validate config only
bash deploy.sh --validate
```

## Configuration

Edit `sites.yaml` to define sites:
```yaml
sites:
  - site_name: "myapp"
    domain: "example.com"
    local_path: "../releases/latest"
    remote_path: "/var/www/myapp"
```

## Requirements
- **Local:** nginx, yq, sudo
- **Remote:** SSH access + same tools on target server

## Templates
- `nginx.conf.tpl` - Main nginx config template
- `site.conf.tpl` - Per-site server blocks (SSL, headers, caching)
