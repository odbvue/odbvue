# OCI Terraform Basic Setup

This setup will create and manage changes for a separate Compartment with single Autonomous Database, Public IP Address, Publicly Accessible Web server with Nginx and static site, Object storage and Email sending capabilities for OCI Free Tier. 

## Concepts

**OCI** - Oracle Cloud Infrastructure: a cloud platform providing compute, storage, networking, and database services.

**Compartment** - A logical container in OCI that organizes and isolates cloud resources. All OCI resources (compute, storage, databases) belong to a compartment. Compartments enable resource organization, access control through Identity and Access Management (IAM), and cost tracking and billing.

**Infrastructure as Code** - Version-controlled automation that defines cloud resources (compute instances, networks, databases) in configuration files instead of manual setup.

**Terraform** - An open-source IaC tool that defines resources declaratively and manages their lifecycle across cloud providers.

## Topology

```
┌─ Compartment: odbvue-test ─────────────────────────────────────────────────┐
│                                                                            │
│  ┌─ VCN: 10.0.0.0/24 ──────────────────────────────────────────────────┐   │
│  │  ┌─ Public Subnet: 10.0.0.0/24 ─────────────────────────────────┐   │   │
│  │  │                                                              │   │   │
│  │  │  ┌─ Compute Instance ────────────────────────────────────┐   │   │   │
│  │  │  │  Shape: VM.Standard.E5.Flex                           │   │   │   │
│  │  │  │  OCPUs: 1, Memory: 4GB                                │   │   │   │
│  │  │  │  Image: Oracle Linux 9                                │   │   │   │
│  │  │  │  Display Name: odbvue-web                             │   │   │   │
│  │  │  │                                                       │   │   │   │
│  │  │  │  Attached VNIC (primary)                              │   │   │   │
│  │  │  │  └─ Private IP: 10.0.0.x (DHCP)                       │   │   │   │
│  │  │  │  └─ Public IP: Reserved                               │   │   │   │
│  │  │  │  └─ NSG: odbvue-nsg-web                               │   │   │   │
│  │  │  │                                                       │   │   │   │
│  │  │  │  INGRESS Rules:                                       │   │   │   │
│  │  │  │    • TCP 80 (HTTP): 0.0.0.0/0                         │   │   │   │
│  │  │  │    • TCP 443 (HTTPS): 0.0.0.0/0                       │   │   │   │
│  │  │  │    • TCP 22 (SSH): 0.0.0.0/0                          │   │   │   │
│  │  │  │                                                       │   │   │   │
│  │  │  │  EGRESS Rules:                                        │   │   │   │
│  │  │  │    • All protocols: 0.0.0.0/0 (all)                   │   │   │   │
│  │  │  └───────────────────────────────────────────────────────┘   │   │   │
│  │  │                                                              │   │   │
│  │  │  ┌─ Internet Gateway (igw) ──────────────────────────────┐   │   │   │
│  │  │  │  Routes all 0.0.0.0/0 outbound                        │   │   │   │
│  │  │  └───────────────────────────────────────────────────────┘   │   │   │
│  │  │                                                              │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                     │   │
│  │  Route Table: odbvue-rt                                             │   │
│  │    • Destination: 0.0.0.0/0 → IGW                                   │   │
│  │                                                                     │   │
│  │  DHCP Options: DNS-Options                                          │   │
│  │    • Domain Name Server: VcnLocalPlusInternet                       │   │
│  │    • Search Domain: vcn.oraclevcn.com                               │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Autonomous Database (ADB) ─────────────────────────────────────────┐   │
│  │  Display Name: odbvue-adb                                           │   │
│  │  Workload Type: OLTP (default)                                      │   │
│  │  CPU Count: 1 (Always Free eligible)                                │   │
│  │  Storage: 1 TB (Always Free eligible)                               │   │
│  │  Backup: Automatic (7 days retention)                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│  ┌─ Email Delivery (Optional) ──────────────────────────────────────────┐  │
│  │  Service: Email Delivery                                             │  │
│  │  SMTP Endpoint: email-smtp.{region}.oci.oraclecloud.com:587          │  │
│  │  Email Domain: Optional domain with DKIM/SPF (var.email_domain)      │  │
│  │  Approved Sender: Optional sender address (var.email_sender)         │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─ Object Storage ─────────────────────────────────────────────────────┐  │
│  │  Bucket: odbvue-bucket                                               │  │
│  │  Tier: Standard                                                      │  │
│  │  Versioning: Enabled (optional)                                      │  │
│  └───────────────────────────────────────────────────── ────────────────┘  │
│                                                                            │
│  ┌─ KMS Vault & Secrets ────────────────────────────────────────────────┐  │
│  │  Vault: odbvue-master-vault                                          │  │
│  │  Master Key (AES-256): odbvue-master-key                             │  │
│  │  Secret: odbvue-plsql-master-key (32-byte encryption key)            │  │
│  │  Purpose: Secure storage for DBMS_CRYPTO master key                  │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> This setup allows SSH connections (port 22) from anywhere. For production environments either limit to whitelisted IP addresses or use Oracle Bastion.

## Prerequisites

### 1. OCI Account

OCI tenant with Administration privileges 

### 2. OCI Configuration saved locally

1. Create `./.oci/` directory in Home directory.

2. Login to the OCI Console.

3. Click your **User icon** → **User Settings**.

4. Go to **Tokens and keys** → **Add API Key** → **Generate key pair in console**.

5. **Download the private key** → save as ~/.oci/default_key.pem.

6. **Copy and save details** to  `./.oci/config`.

```ini
[DEFAULT]
user=ocid1.user.oc1..aaaa1234
fingerprint=12:34:56:78:90:ab:cd:ef
tenancy=ocid1.tenancy.oc1..aaaa1234
region=us-ashburn-1
key_file=~/.oci/default_key.pem
```

> [!NOTE]
> If there are multiple tenancies, all can be put in a single file.

```ini
[TEST]
user=ocid1.user.oc1..bbbb5678
fingerprint=ab:cd:ef:12:34:56:78:90
tenancy=ocid1.tenancy.oc1..bbbb5678
region=eu-frankfurt-1
key_file=~/.oci/test_key.pem

[PROD]
user=ocid1.user.oc1..cccc9012
fingerprint=56:78:90:ab:cd:ef:12:34
tenancy=ocid1.tenancy.oc1..cccc9012
region=ap-singapore-1
key_file=~/.oci/prod_key.pem
```

> [!NOTE] 
> Use Linux-style paths in `key_file` even on Windows.

### 3. Generated SSH Key pair

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/odbvue -N ""
```
Keys will be saved to `~/.ssh` in your home directory.

### 4. Install Terraform

[Install Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)

For Windows:

```powershell
winget install HashiCorp.Terraform
```

After installation check that it works:

```bash
terraform -v
```

## Deployment

### Step 1. Initial setup (once)

```bash
cd terraform
terraform init
```

### Step 2. Create terraform configuration files

#### `@/provider.tf` - Configures OCI provider with authentication profile and region

::: details source
<<< ../../../../../i13e/oci/basic/terraform/provider.tf
:::

#### `@/versions.tf` - Specifies Terraform and provider version requirements

::: details source
<<< ../../../../../i13e/oci/basic/terraform/versions.tf
:::

#### `@/variables.tf` - Input variables for OCI profile, region, credentials, ADB, email, and resource names

::: details source
<<< ../../../../../i13e/oci/basic/terraform/variables.tf
:::

#### `@/oci_config.tf` - Deprecated (use variables.tf)

::: details source
<<< ../../../../../i13e/oci/basic/terraform/oci_config.tf
:::

#### `@/compartment.tf` - Creates or retrieves OCI compartment "odbvue-test"

::: details source
<<< ../../../../../i13e/oci/basic/terraform/compartment.tf
:::

#### `@/networking.tf` - VCN, Internet Gateway, route tables, DHCP options, subnet, and NSG with firewall rules

::: details source
<<< ../../../../../i13e/oci/basic/terraform/networking.tf
:::

#### `@/compute.tf` - Oracle Linux 9 VM instance with NGINX, SSH configuration, and cloud-init setup

::: details source
<<< ../../../../../i13e/oci/basic/terraform/compute.tf
:::

#### `@/public_ip.tf` - Reserves and attaches public IP to compute instance

::: details source
<<< ../../../../../i13e/oci/basic/terraform/public_ip.tf
:::

#### `@/adb.tf` - Autonomous Database (Always Free), wallet generation and download

::: details source
<<< ../../../../../i13e/oci/basic/terraform/adb.tf
:::

#### `@/identity.tf` - Dynamic Group and Policy to access Object Storage from Autonomous Database

::: details source
<<< ../../../../../i13e/oci/basic/terraform/identity.tf
:::

#### `@/email.tf` - Email Delivery domain and approved sender

::: details source
<<< ../../../../../i13e/oci/basic/terraform/email.tf
:::

#### `@/objectstorage.tf` - Object Storage bucket with restricted access

::: details source
<<< ../../../../../i13e/oci/basic/terraform/objectstorage.tf
:::

#### `@/outputs.tf` - Exports instance IPs, ADB connection info, and storage hints

::: details source
<<< ../../../../../i13e/oci/basic/terraform/outputs.tf
:::

#### `@/vault.tf` - OCI KMS Vault, master encryption key, and secret storage for DBMS_CRYPTO

::: details source
<<< ../../../../../i13e/oci/basic/terraform/vault.tf
:::

#### `@/terraform.tfvars.example` - Template showing required variables

::: details source
<<< ../../../../../i13e/oci/basic/terraform/terraform.tfvars.example {ini}
:::

#### `@/.gitignore` - Prevents secrets and terraform state from being submitted to git

::: details source
<<< ../../../../../i13e/oci/basic/.gitignore {ini}
:::

> [!WARNING] 
> Make sure that `.gitignore` exists and prevents secrets and terraform state from being submitted to git.

### Step 3. Configure terraform.tfvars

Copy `terraform.tfvars.example` to `terraform.tfvars` and update with your values.

| Variable | Description | Example |
|----------|-------------|---------|
| `tenancy_ocid` | Your OCI Tenancy OCID from API credentials | `ocid1.tenancy.oc1..aaaaaaaa...` |
| `oci_profile` | OCI profile name from ~/.oci/config | `DEFAULT` |
| `region` | OCI region code | `eu-frankfurt-1` |
| `adb_admin_password` | Autonomous Database admin password (9-30 chars, must include uppercase, lowercase, digit, special char) | `MySecurePass123!` |
| `adb_wallet_password` | Password for ADB wallet encryption | `MySecurePass123!` |
| `ssh_public_key_path` | Path to SSH public key for compute instance | `../.ssh/odbvue.pub` |
| `adb_db_name` | Autonomous Database name | `odbvueadb` |
| `adb_workload` | Database workload type: OLTP, DW, AJD, or APEX | `OLTP` |
| `adb_cpu_count` | Number of OCPUs for ADB (1 for Always Free) | `1` |
| `adb_storage_tb` | Storage in TB for ADB (1 for Always Free) | `1` |
| `email_sender` | Email Delivery approved sender (optional, leave empty to skip) | `admin@odbvue.com` |
| `email_domain` | Email domain for DKIM/SPF (optional, outputs DNS records to add manually) | `odbvue.com` |

### Step 4. Apply changes to infrastructure

```bash
terraform plan
```

```bash
terraform apply
```

> [!NOTE]
> On succesful Autonomous Database modification Wallet will be automatically downloaded to `./wallets/` folder. Make sure that the folder exists.

### Step 5. (if needed) Destroy infrastructure

```bash
terraform destroy
```

## Web Server Setup

After Compute infrastructure is up and running it is necessary to set up Nginx and prepare for site deployment.

### Step 1. Configuration

Nginx configuration template:

#### `./i13e/oci/basic/scripts/nginx.conf.tpl` 

::: details source
<<< ../../../../../i13e/oci/basic/scripts/nginx.conf.tpl {ini}
::: 

Nginx individual Site configuration template:

#### `./i13e/oci/basic/scripts/nginx.site.conf.tpl` 

::: details source
<<< ../../../../../i13e/oci/basic/scripts/nginx.site.conf.tpl {ini}
::: 

Sites:

#### `./i13e/oci/basic/scripts/sites.yaml` 

::: details source
<<< ../../../../../i13e/oci/basic/scripts/sites.yaml
::: 

### Step 2. SSL Certificates

Assure that Wildcard SSL certificates are in `./scripts/.sll/` folder.

### Step 3. Copy all needed files to remote server

Script will copy all configuration files, scripts and site content to web server's `~\deploy\` folder.

```bash
./copy.sh [ssh-key] opc@[public-ip-address]
#./copy.sh ~/.ssh/odbvue opc@12.34.56.789
```

#### `./i13e/oci/basic/scripts/copy.sh` 

::: details source
<<< ../../../../../i13e/oci/basic/scripts/copy.sh
::: 

### Step 4. Run setup

Script will setup Nginx based on configuration templates and will create `Helo, {site-name}!` sites according to `./sites.yaml`. 

```bash
chmod +x ./setup.sh
./setup.sh
```

#### `./i13e/oci/basic/scripts/setup.sh` 

::: details source
<<< ../../../../../i13e/oci/basic/scripts/setup.sh
::: 

### Step 5. Deploy content (optional)

Script will deploy actual content based on `./sites.yaml`. 

```bash
chmod +x ./deploy.sh
./deploy.sh
```

#### `./i13e/oci/basic/scripts/deploy.sh` 

::: details source
<<< ../../../../../i13e/oci/basic/scripts/deploy.sh
::: 

## Email sending setup

### DNS Records

Terraform will output records that need to be added to DNS manually. Example:

1. DKIM CNAME Record (for email authentication):

- Name:  odbvue-dkim-eu-stockholm-1._domainkey.odbvue.com.

- Type:  CNAME

- Value: odbvue-dkim-eu-stockholm-1.odbvue.com.dkim.arn1.oracleemaildelivery.com

2. SPF TXT Record (for sender policy framework):

- Name:  @ (or your domain root)

- Type:  TXT

- Value: v=spf1 include:eu-stockholm-1.rp.oracleemaildelivery.com ~all    

> [!NOTE]
> If you already have an SPF record, ADD this to it:
> include:eu-stockholm-1.rp.oracleemaildelivery.com
> (Don't create multiple SPF records - merge into existing one)       


After adding these DNS records:

- Wait 10-30 minutes for DNS propagation

- The domain state will change from CREATING to ACTIVE

- DKIM state will change to ACTIVE

- SPF will be detected automatically (is_spf = true)

- Run 'terraform refresh' to check status


## Vault & Secrets Management

### Overview

The infrastructure includes an **OCI KMS Vault** that securely stores the master encryption key used by PL/SQL's `DBMS_CRYPTO` for encrypting sensitive application settings.

**Architecture:**
- **KMS Vault** (`odbvue-master-vault`) - Secured container for cryptographic keys
- **Master Key** (`odbvue-master-key`) - AES-256 symmetric key used to encrypt vault secrets
- **Secret** (`odbvue-plsql-master-secret`) - 32-byte base64-encoded encryption key for DBMS_CRYPTO

### Security Features

- **Key Encryption** - The 32-byte master key is encrypted by OCI KMS before storage  
- **Audit Logging** - All vault access is logged to OCI Cloud Audit  
- **Resource Principal** - ADB authenticates using IAM resource principal (no credentials in code)  
- **Lifecycle Protection** - Resources have `prevent_destroy` lifecycle rules  

### Terraform Outputs

After `terraform apply`, retrieve the vault secret OCID:

```bash
terraform output vault_secret_ocid
# Output: ocid1.vaultsecret.oc1.eu-stockholm-1.xxxxx
```

