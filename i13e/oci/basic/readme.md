# OCI Terraform Basic Setup

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

> [!Note]
> This setup allows SSH connections (port 22) from anywhere. For production environments either limit to whitelisted IP addresses or use Oracle Bastion.

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

### Destroy everything (if needed)

```bash
terraform destroy
```

## Terraform files

Terraform files:
- **provider.tf** - Configures OCI provider with authentication profile and region
- **versions.tf** - Specifies Terraform and provider version requirements
- **variables.tf** - Input variables for OCI profile, region, credentials, ADB, email, and resource names
- **oci_config.tf** - Deprecated (use variables.tf)
- **compartment.tf** - Creates or retrieves OCI compartment "odbvue-test"
- **networking.tf** - VCN, Internet Gateway, route tables, DHCP options, subnet, and NSG with firewall rules
- **compute.tf** - Oracle Linux 9 VM instance with NGINX, SSH configuration, and cloud-init setup
- **public_ip.tf** - Reserves and attaches public IP to compute instance
- **adb.tf** - Autonomous Database (Always Free), wallet generation and download
- **email.tf** - Optional Email Delivery approved sender (if `var.email_sender` set)
- **objectstorage.tf** - Object Storage bucket with restricted access
- **outputs.tf** - Exports instance IPs, ADB connection info, and storage hints
- **terraform.tfvars** - Configuration file with sensitive values (not in version control)
- **terraform.tfvars.example** - Template showing required variables
- **terraform.tfstate** - Terraform state file (auto-managed)
- **terraform.tfstate.backup** - State file backup

> [!NOTE] 
> Make sure that `.gitignore` exists and prevents secrets and terraform state from being submitted to git.