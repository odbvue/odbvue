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

1. Create the directory: `mkdir ".oci"` (in the `i13e/oci/` directory)
2. Create a file: `.oci/config`
3. Copy your private key file to `.oci/oci_api_key.pem`
4. Paste the configuration from Step 1 into the config file
5. **Important**: Update the `key_file` path to use the container path format shown below

> [!WARNING]
> Make sure that the `.oci/` directory is git-ignored for security.

#### Example config file:
```
[DEFAULT]
user=ocid1.user.oc1..aaaa...
fingerprint=aa:bb:cc:...
tenancy=ocid1.tenancy.oc1..aaaa...
region=eu-frankfurt-1
key_file=/root/.oci/oci_api_key.pem
```

> [!TIP] 
> Even on Windows, use the Linux-style path `/root/.oci/oci_api_key.pem` for the `key_file` setting. This is because the OCI CLI runs inside a Linux container where your local `.oci` directory is mounted to `/root/.oci`. Do not use quotes around the path.

All scripts are located in `./i13e/oci/scripts/` folder and must be run from `./i13e/oci/`. Append `bash` when running on Windows.  

## List resources

List resources using the default profile:
```bash
./scripts/list.sh
```

List resources using a specific profile:
```bash
./scripts/list.sh PRODUCTION
```

## Deploy ATP Database

### Variables

Before deploying, **Create sensitive variables file** for each environment, e.g. for test `terraform/environments/test/terraform.tfvars.local`:

```
admin_password    = "YourSecurePassword123!"
wallet_password   = "YourWalletPassword123!"
```
Password Requirements:
- Must be 12-30 characters long
- Must contain at least 1 uppercase letter
- Must contain at least 1 lowercase letter  
- Must contain at least 1 numeric character
- Must contain at least 1 special character

> [!WARNING]
> Make sure that the `*.local` is always git-ignored for security.

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
./scripts/deploy-atp.sh -e test -a apply -y
./scripts/deploy-atp.sh -e prod -a apply -y
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

**Download wallet:**
```bash
./scripts/download-atp-wallet.sh -e test -o ~/.wallets/odbvue-test-wallet.zip
./scripts/download-atp-wallet.sh -e prod -o ~/.wallets/odbvue-prod-wallet.zip
```

> [!WARNING]
> Make sure that the `.wallets/` and `*.zip` are git-ignored for security.
