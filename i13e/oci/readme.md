# OCI Setup

Manage Oracle Cloud Infrastructure resources using Pulumi with TypeScript.

## Prerequisites

- OCI account with admin access

## Setup

### 1. Generate API Key

1. Log in to Oracle Cloud Console
2. Click your profile icon (top right) → **User Settings**
3. Under **Tokens and keys**, click **Add API Key**
4. Select **Generate API Key Pair** 
5. click **download the private key file** 
6. Press **Add** and copy the configuration file preview that appears

### 2. Configure Credentials

1. Save your private key files as `.oci/{keyname}.pem`
2. Create `.oci/config` with your profile:

```ini
[DEFAULT]
user=ocid1.user.oc1..aaaa1234
fingerprint=12:34:56:78:90:ab:cd:ef
tenancy=ocid1.tenancy.oc1..aaaa1234
region=us-ashburn-1
key_file=/root/.oci/default_key.pem
```

> [!NOTE]
> If there are multiple tenancies, all can be put in a single file.

```ini
[DEV]
user=ocid1.user.oc1..bbbb5678
fingerprint=ab:cd:ef:12:34:56:78:90
tenancy=ocid1.tenancy.oc1..bbbb5678
region=eu-frankfurt-1
key_file=/root/.oci/dev_key.pem

[PROD]
user=ocid1.user.oc1..cccc9012
fingerprint=56:78:90:ab:cd:ef:12:34
tenancy=ocid1.tenancy.oc1..cccc9012
region=ap-singapore-1
key_file=/root/.oci/prod_key.pem
```

> [!NOTE] 
> Use Linux-style paths in `key_file` even on Windows.

## Usage

All scripts in the `./scripts` directory manage OCI infrastructure components. Run them using `tsx` or `pnpm`.

### 1. check-availability.ts

Check resource availability and get deployment recommendations.

**Purpose**: Lists available compute shapes, OS images, and generates copy-pastable YAML configurations based on what's available in your region.

**Usage**:
```bash
pnpm check-availability -c ./.oci/config -p ODBVUE
pnpm check-availability -c ./.oci/config -p DEFAULT
```

**Output**: Shows available VM shapes (ARM and x86), compatible OS images, and provides copy-pastable YAML configurations for deployment.

---

### 2. deploy-web.ts

Deploy OCI compute instance with network infrastructure.

**Purpose**: Creates a complete web server deployment including VCN, subnet, security rules, compute instance, and generates SSH helper scripts.

**Usage**:
```bash
# Plan deployment (dry-run)
pnpm deploy-web -c ./.oci/config -p ODBVUE -f ./workspace/web-odbvue.yaml -a plan

# Apply deployment
pnpm deploy-web -c ./.oci/config -p ODBVUE -f ./workspace/web-odbvue.yaml -a apply

# Destroy all resources
pnpm deploy-web -c ./.oci/config -p ODBVUE -f ./workspace/web-odbvue.yaml -a destroy --force
```

**Output**: After apply, displays compute instance IP, SSH connection commands, and generates helper scripts at `.ssh/scripts/`.

---

### 3. deploy-atp.ts

Deploy Oracle Autonomous Transaction Processing database.

**Purpose**: Creates or updates ATP instances, displays connection URLs (APEX, SQL Developer Web, etc.).

**Usage**:
```bash
# Plan deployment
pnpm deploy-atp -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -a plan

# Apply deployment
pnpm deploy-atp -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -a apply

# Destroy ATP instance
pnpm deploy-atp -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -a destroy

# Quiet mode (only results)
pnpm deploy-atp -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -a apply -q
```

**Output**: Connection URLs for APEX, SQL Developer Web, Database Actions, and other tools.

---

### 4. deploy-sites.ts

Deploy static websites and Vue.js apps to web server.

**Purpose**: Uploads site files to remote server and manages deployment across multiple sites.

**Usage**:
```bash
# Deploy all sites from YAML configuration
pnpm deploy-sites -c ./.oci/ -p ODBVUE -f ./templates/web-odbvue.yaml

# Deploy specific site only
pnpm deploy-sites -c ./.oci/ -p ODBVUE -f ./templates/web-odbvue.yaml deploy apps

# Check deployment status
pnpm deploy-sites -c ./.oci/ -p ODBVUE -f ./templates/web-odbvue.yaml status
```

**Output**: Deployment logs, nginx test results, SSL verification, and final deployment summary with URLs.

---

### 5. download-wallet.ts

Download ATP wallet and display connection strings.

**Purpose**: Generates and downloads the Oracle Wallet file needed to connect to ATP from applications, and displays database connection examples.

**Usage**:
```bash
# Download wallet with default config
pnpm download-wallet -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -w ./wallet/wallet.zip

# Download wallet to specific location
pnpm download-wallet -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -w /tmp/wallet.zip

# Quiet mode
pnpm download-wallet -c ./.oci/config -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -w ./wallet.zip -q
```

**Output**: Wallet file, connection strings for SQL*Plus, JDBC, Python, Node.js, and web URLs.

---

### 6. setup-nginx.ts

Configure nginx on web server with SSL.

**Purpose**: Installs nginx, uploads SSL certificates, generates server blocks, configures firewall, and starts the web server.

**Usage**:
```bash
# Setup nginx from web server configuration
pnpm setup-nginx ./workspace/web-odbvue.yaml
```

**Output**: Nginx installation logs, SSL certificate verification, firewall configuration, and final site URLs.

---

### 7. ssl-diagnostic.ts

Troubleshoot SSL/TLS certificate issues.

**Purpose**: Runs comprehensive SSL diagnostics on remote server, checks certificate validity, fixes permissions, and tests SSL handshake.

**Usage**:
```bash
# Run SSL diagnostics
pnpm ssl-diagnostic ./workspace/web-odbvue.yaml
```

**Output**: Nginx status, certificate file checks, SSL handshake tests, error logs, and permission fixes.

---

### 8. status.ts

Discover and list all OCI resources.

**Purpose**: Lists all compute instances, VCNs, storage buckets, databases, and autonomous databases across all compartments.

**Usage**:
```bash
# List all resources with verbose output
pnpm status -c ./.oci/config -p ODBVUE

# Quiet mode - only YAML output
pnpm status -c ./.oci/config -p ODBVUE -q

# Default profile (uses ~/.oci/config)
pnpm status
```

**Output**: Full resource inventory organized by service and compartment in YAML format.

---

## Common Workflow

```bash
# 1. Check what's available in your region
pnpm check-availability -c ./.oci/ -p ODBVUE

# 2. Copy output to web-odbvue.yaml configuration

# 3. Deploy web infrastructure
pnpm deploy-web -c ./.oci/ -p ODBVUE -f ./workspace/web-odbvue.yaml -a apply

# 4. Deploy database
pnpm deploy-atp -c ./.oci/ -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -a apply

# 5. Setup web server
node scripts/setup-nginx.ts ./workspace/web-odbvue.yaml

# 6. Deploy sites
pnpm deploy-sites -c ./.oci/ -p ODBVUE -f ./templates/web-odbvue.yaml

# 7. Download database wallet
pnpm download-wallet -c ./.oci/ -p ODBVUE -f ./workspace/atp-erlihs-odbvue.yaml -w ./wallet/wallet.zip

# 8. Check deployment status
pnpm status -c ./.oci/ -p ODBVUE
```

