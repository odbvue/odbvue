# Manage OCI

This guide will provide how to manage Oracle Cloud Infrastructure (OCI) resources remotely using Terraform (Infrastructure as a code) 

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

All OCI setup is located into `./i13e/oci/` folder.

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
