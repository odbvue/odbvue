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

