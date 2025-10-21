# Manage OCI

This guide will provide how to manage Oracle Cloud Infrastructure (OCI) resources remotely using Terraform (Infrastructure as a code) 

## Files in this Directory

- `Dockerfile` - Container image definition with OCI CLI and Terraform
- `entrypoint.sh` - Container entrypoint script
- `scripts/` - Directory containing management scripts
  - `list.sh` - Bash script to list OCI resources (works on Windows/Linux/Mac)
  - `deploy-atp.sh` - Bash script to deploy ATP databases (works on Windows/Linux/Mac)
  - `download-atp-wallet.sh` - Bash script to download ATP database wallet files (works on Windows/Linux/Mac)
- `terraform/` - Infrastructure as Code definitions
  - `modules/atp/` - Reusable ATP database module
  - `environments/test/` - Test environment configuration
  - `environments/prod/` - Production environment configuration
- `configs/` - Configuration files
  - `environments.yaml` - Environment definitions and settings
  - `defaults.yaml` - Default configuration values
- `.oci/` - Directory for your OCI credentials (git-ignored)
- `.gitignore` - Ensures credentials are not committed to version control

## Prerequisites

1. **OCI account**

2. **Podman installed** on your machine:
   - **Windows (multiple options available)**:
     - **Direct installer (Recommended)**: Download the latest Windows installer from [GitHub Releases](https://github.com/containers/podman/releases) (`podman-installer-windows-amd64.exe`)
     - **Winget**: `winget install RedHat.Podman`
     - **Chocolatey**: `choco install podman-cli`
     - **Podman Desktop** (GUI + CLI): [podman-desktop.io](https://podman-desktop.io/) - Full graphical interface with CLI included
   - Linux/Mac: [Podman Installation Guide](https://podman.io/getting-started/installation)

3. **Bash shell** (available everywhere):
   - Windows: Git Bash, WSL, or PowerShell with bash support
   - Linux/Mac: Built-in terminal

## Common setup

Before deploying any OCI resources (ATP, Compute, etc.), you must set up access configuration to connect to OCI.

### Step 1: Get your OCI API key

1. Log in to Oracle Cloud Console
2. Click your profile icon (top right) → **User Settings**
3. Under **Tokens and keys**, click **Add API Key**
4. Select **Generate API Key Pair** and **download the private key file** (save it somewhere safe, e.g., `~/.oci/oci_api_key.pem`)
5. Press **Add** and copy the configuration file preview that appears

### Step 2: Configure OCI credentials

**For all platforms (Windows/Linux/Mac):**
1. Create the directory: `mkdir ".oci"` (in the `i13e/oci/` directory)
2. Create a file: `.oci/config`
3. Copy your private key file to `.oci/oci_api_key.pem`
4. Paste the configuration from Step 1 into the config file
5. **Important**: Update the `key_file` path to use the container path format shown below

**Note**: The `.oci/` directory is already git-ignored for security.

#### Example config file content (all platforms):
```
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=aa:bb:cc:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=eu-frankfurt-1
key_file=/root/.oci/oci_api_key.pem
```

> **Note**: Even on Windows, use the Linux-style path `/root/.oci/oci_api_key.pem` for the `key_file` setting. This is because the OCI CLI runs inside a Linux container where your local `.oci` directory is mounted to `/root/.oci`. Do not use quotes around the path.

## List resources

This guide provides scripts to list all your OCI resources using a containerized approach with Podman, OCI CLI, and Terraform. The scripts automatically build and use a Docker container with all necessary tools pre-installed.

### Features

- **Containerized Environment**: Uses Podman to run OCI CLI in an isolated container
- **No Local Dependencies**: Only requires Podman installed on your machine
- **Multi-Profile Support**: Works with multiple OCI profiles configured in `~/.oci/config`
- **Comprehensive Listing**: Lists all major OCI resource types:
  - Compartments
  - Compute Instances
  - Autonomous Databases (ATP/ADW)
  - Virtual Cloud Networks (VCNs)
  - Subnets
  - Block Volumes
  - Boot Volumes
  - Object Storage Buckets
  - Load Balancers

### Usage (All Platforms)

List resources using the default profile:
```bash
./scripts/list.sh
```

List resources using a specific profile:
```bash
./scripts/list.sh PRODUCTION
```

> **Note**: These bash scripts work on Windows (Git Bash/WSL), Linux, and Mac. The containerized approach means identical behavior across all platforms.

### How It Works

1. The script checks if Podman is installed and OCI credentials are configured
2. If needed, it builds a container image with OCI CLI and Terraform pre-installed
3. The script runs OCI CLI commands inside the container, mounting your `~/.oci` directory
4. Results are displayed in a formatted table output

### Troubleshooting

**Error: "Podman is not installed"**
- Install Podman from the official website

**Error: "OCI config directory not found"**
- Make sure you've completed the "Common setup" section above
- Verify that `.oci/config` exists in the `i13e/oci/` directory

**Error: "Profile not found"**
- Check your `~/.oci/config` file for available profiles
- Ensure the profile name matches exactly (case-sensitive)

**No resources listed**
- Verify your OCI credentials are correct
- Check that you have the necessary permissions in OCI
- Ensure you're using the correct region in your config file

## Deploy ATP Database

This guide provides scripts to deploy ATP (Autonomous Transaction Processing) databases using Terraform in containerized environments for both test and production.

### Prerequisites for ATP Deployment

1. **Complete the "Common setup" section above**
2. **Create sensitive variables file** for each environment:

#### Test Environment
Create `terraform/environments/test/terraform.tfvars.local`:
```
admin_password    = "YourSecurePassword123!"
wallet_password   = "YourWalletPassword123!"
```

#### Production Environment  
Create `terraform/environments/prod/terraform.tfvars.local`:
```
admin_password    = "YourSecureProductionPassword123!"
wallet_password   = "YourProductionWalletPassword123!"
```

### Password Requirements
- Must be 12-30 characters long
- Must contain at least 1 uppercase letter
- Must contain at least 1 lowercase letter  
- Must contain at least 1 numeric character
- Must contain at least 1 special character

### Deploy ATP Database (All Platforms)

**Initialize Terraform (first time only):**
```bash
./scripts/deploy-atp.sh -e test -a init
./scripts/deploy-atp.sh -e prod -a init
```

**Plan deployment (preview changes):**
```bash
./scripts/deploy-atp.sh -e test -a plan
./scripts/deploy-atp.sh -e prod -a plan
```

**Deploy database:**
```bash
./scripts/deploy-atp.sh -e test -a apply
./scripts/deploy-atp.sh -e prod -a apply
```

**Destroy database:**
```bash
./scripts/deploy-atp.sh -e test -a destroy
./scripts/deploy-atp.sh -e prod -a destroy
```

**Destroy database (auto-approve, skip confirmation):**
```bash
./scripts/deploy-atp.sh -e test -a destroy -y
./scripts/deploy-atp.sh -e prod -a destroy -y
```

**View outputs:**
```bash
./scripts/deploy-atp.sh -e test -a output
```

> **Cross-Platform**: These bash scripts work identically on Windows (Git Bash/WSL), Linux, and Mac.

### Environment Differences

#### Test Environment
- **Free tier enabled** (no cost)
- **Single OCPU core**
- **No IP restrictions** (accessible from anywhere)
- **Auto-approve enabled** for faster development
- **No Data Guard** (high availability disabled)

#### Production Environment
- **Paid tier** (higher performance and features)
- **2 OCPU cores** by default
- **IP restrictions** (configure in `terraform.tfvars`)
- **Manual approval required** for safety
- **Data Guard enabled** (automatic failover)
- **Auto-scaling enabled**

### Using Different OCI Profiles

If you have multiple OCI profiles configured:

```bash
# All platforms
./scripts/deploy-atp.sh -e prod -a plan -p PRODUCTION
./scripts/list.sh PRODUCTION
```

### Safety Features

1. **Production Protection**: Production deployments require manual confirmation
2. **Destruction Protection**: Destroying databases requires typing "DELETE"
3. **Terraform State**: Local state files track what's deployed
4. **Password Security**: Sensitive files are git-ignored
5. **Preview Changes**: Always run `plan` before `apply`

> **⚠️ WARNING**: The ATP module has `prevent_destroy = false` set for easier development and testing. This means databases can be destroyed without Terraform-level protection. Always double-check your commands before running destroy operations, especially in production environments.

## Download ATP Wallet

After successfully deploying an ATP database, you need to download the wallet file to connect to it. The wallet contains the necessary certificates and connection configurations for secure database access.

### Prerequisites for Wallet Download

1. **Complete the "Common setup" section above**
2. **Deploy an ATP database** using the deploy-atp.sh script
3. **Terraform state must exist** (the database must be successfully deployed)

### Download Wallet (All Platforms)

**Download wallet to default location (./wallet.zip):**
```bash
./scripts/download-atp-wallet.sh -e test
./scripts/download-atp-wallet.sh -e prod
```

**Download wallet to custom location:**
```bash
./scripts/download-atp-wallet.sh -e test -o ~/Downloads/odbvue-test-wallet.zip
./scripts/download-atp-wallet.sh -e prod -o ~/Downloads/odbvue-prod-wallet.zip
```

**Quiet mode (suppress verbose output):**
```bash
./scripts/download-atp-wallet.sh -e test -o ./test-wallet.zip -q
```

> **Cross-Platform**: These bash scripts work identically on Windows (Git Bash/WSL), Linux, and Mac.

### Script Options

| Option | Description | Example |
|--------|-------------|---------|
| `-e, --environment` | Target environment (test or prod) | `-e test` |
| `-o, --output` | Output path for wallet file (default: ./wallet.zip) | `-o ~/wallet.zip` |
| `-q, --quiet` | Suppress verbose output | `-q` |
| `-h, --help` | Show help message | `-h` |

### How It Works

1. **Validates Prerequisites**: Checks for Podman, OCI credentials, and Terraform state
2. **Builds Container**: Uses the same containerized environment as other scripts
3. **Extracts Database ID**: Gets the ATP database ID from Terraform state
4. **Downloads Wallet**: Uses OCI CLI to generate and download the wallet file
5. **Validates Output**: Verifies the wallet file was created successfully

### Using the Downloaded Wallet

After downloading the wallet, follow these steps to connect to your ATP database:

#### Step 1: Extract the Wallet
```bash
# Extract to a directory
unzip wallet.zip -d ./wallet/
```

#### Step 2: Set Environment Variable
```bash
# Set TNS_ADMIN to the wallet directory
export TNS_ADMIN="$(pwd)/wallet"
```

#### Step 3: Get Connection Information
```bash
# View available connection strings
./scripts/deploy-atp.sh -e test -a output
```

#### Step 4: Connect to Database
Use the connection strings with your database client:
- **Username**: `admin`
- **Password**: The admin password you configured in `terraform.tfvars.local`
- **Connection String**: Use one from the Terraform output (e.g., `odbvue_high`, `odbvue_medium`, `odbvue_low`)

### Connection Examples

**SQL*Plus:**
```bash
sqlplus admin@odbvue_high
```

**SQLcl:**
```bash
sql admin@odbvue_high
```

**Application Connection String:**
```
jdbc:oracle:thin:@odbvue_high?TNS_ADMIN=/path/to/wallet
```

### Wallet Security

- **Wallet Password**: The script uses a fixed wallet password: `OdbVue2025Wallet#!`
- **Database Password**: Use the admin password you configured during deployment
- **File Permissions**: Keep wallet files secure and don't commit them to version control
- **Rotation**: Download a fresh wallet if you suspect it's been compromised

### Troubleshooting

**Error: "Terraform state not found"**
- Deploy the ATP database first using `./scripts/deploy-atp.sh -e <env> -a apply`

**Error: "Failed to get database ID"**
- Ensure the database deployment completed successfully
- Check Terraform state with `./scripts/deploy-atp.sh -e <env> -a output`

**Error: "Wallet file was not created"**
- Check your OCI permissions for downloading wallets
- Verify the database is in "Available" state in OCI console

**Connection Issues:**
- Verify `TNS_ADMIN` environment variable is set correctly
- Check that wallet files were extracted to the correct directory
- Ensure you're using the correct connection string and credentials
