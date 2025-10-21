# Manage OCI

This guide will provide how to manage Oracle Cloud Infrastructure (OCI) resources remotely using Terraform (Infrastructure as a code) 

## Files in this Directory

- `Dockerfile` - Container image definition with OCI CLI and Terraform
- `entrypoint.sh` - Container entrypoint script
- `scripts/` - Directory containing management scripts
  - `list.ps1` - PowerShell script for Windows to list OCI resources
  - `list.sh` - Bash script for Linux/Mac to list OCI resources
- `.oci/` - Directory for your OCI credentials (git-ignored)
- `.gitignore` - Ensures credentials are not committed to version control

## Prerequisites

1. OCI account

2. Podman installed on local machine

## Common setup

Before deploying any OCI resources (ATP, Compute, etc.), you must set up access configuration to connect to OCI.

### Step 1: Get your OCI API key

1. Log in to Oracle Cloud Console
2. Click your profile icon (top right) → **User Settings**
3. Under **Tokens and keys**, click **Add API Key**
4. Select **Generate API Key Pair** and **download the private key file** (save it somewhere safe, e.g., `~/.oci/oci_api_key.pem`)
5. Press **Add** and copy the configuration file preview that appears

### Step 2: Configure OCI credentials

1. Create the directory: `mkdir ~/.oci` (or `mkdir $HOME\.oci` on Windows)
2. Create a file `~/.oci/config` (or `$HOME\.oci\config` on Windows)
3. Paste the configuration from Step 1 into this file
4. **Important**: Update the `key_file` path to use the container path format shown below

#### Example for Linux/Mac:
```
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=aa:bb:cc:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=eu-frankfurt-1
key_file=/root/.oci/oci_api_key.pem
```

#### Example for Windows:
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

### Prerequisites

1. **Podman installed** on your machine
   - Windows: [Podman Desktop](https://podman-desktop.io/)
   - Linux/Mac: [Podman Installation Guide](https://podman.io/getting-started/installation)

2. **OCI credentials configured** (see "Common setup" section above)

### Windows

List resources using the default profile:
```powershell
.\scripts\list.ps1
```

List resources using a specific profile:
```powershell
.\scripts\list.ps1 -Profile PRODUCTION
```

### Linux/Mac

List resources using the default profile:
```bash
chmod +x scripts/list.sh
./scripts/list.sh
```

List resources using a specific profile:
```bash
./scripts/list.sh PRODUCTION
```

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
- Verify that `~/.oci/config` exists (or `$HOME\.oci\config` on Windows)

**Error: "Profile not found"**
- Check your `~/.oci/config` file for available profiles
- Ensure the profile name matches exactly (case-sensitive)

**No resources listed**
- Verify your OCI credentials are correct
- Check that you have the necessary permissions in OCI
- Ensure you're using the correct region in your config file
