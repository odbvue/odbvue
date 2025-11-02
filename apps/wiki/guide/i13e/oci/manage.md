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
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌─ Object Storage ─────────────────────────────────────────────────────┐  │
│  │  Bucket: odbvue-bucket                                               │  │
│  │  Tier: Standard                                                      │  │
│  │  Versioning: Enabled (optional)                                      │  │
│  └───────────────────────────────────────────────────── ────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

> [!WARNING]
> This setup allows SSH connections (port 22) from anywhere. For production environments either limit to whitelisted IP addresses or use Oracle Bastion.

## Prerequisites

OCI Account.

## Prepare Environment

### Step 1. Get OCI Config

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

### Step 2. Generate SSH Key

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/odbvue -N ""
```
Keys will be saved to `~/.ssh`.

### Step 3. Install Terraform

[Install Terraform](https://developer.hashicorp.com/terraform/tutorials/aws-get-started/install-cli)

For Windows:

```powershell
winget install HashiCorp.Terraform
```

After installation check that it works:

```bash
terraform -v
```

### Step 4. Configure terraform.tfvars

Copy `terraform.tfvars.example` to `terraform.tfvars` and update with your values.

## Usage

### Initial setup (once)

```bash
cd terraform
terraform init
```

### Apply changes to infrastructure

```bash
terraform plan
```

```bash
terraform apply
```

> [!NOTE]
> On succesful Autonomous Database modification Wallet will be automatically downloaded to `./wallets/` folder. Make sure that the folder exists.

### Destroy everything (if needed)

```bash
terraform destroy
```

## Terraform files

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

#### `@/email.tf` - Optional Email Delivery approved sender (if `var.email_sender` set)

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

#### `@/terraform.tfvars.example` - Template showing required variables

::: details source
<<< ../../../../../i13e/oci/basic/terraform/terraform.tfvars.example {ini}
:::

> [!NOTE] 
> Make sure that `.gitignore` exists and prevents secrets and terraform state from being submitted to git.

#### `@/.gitignore` - Prevents secrets and terraform state from being submitted to git

::: details source
<<< ../../../../../i13e/oci/basic/.gitignore {ini}
:::

