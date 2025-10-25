# Manage OCI - Basic

This setup is suited for basic infrastructure - several Database and Compute instances, no load balancing.

## Prepare environment

### Step 1. Configure Credentials

1. Create `./.oci/` directory
2. Save your private key files as `./.oci/{keyname}.pem`
3. Create `./.oci/config` with your profile:

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

---

### Todo

<<< ./.gitignore

pnpm install oci-sdk
pnpm add @types/node
pnpm add -D tsx
pnpm approve-builds
pnpm add js-yaml @types/js-yaml

config.yaml

[!NOTE] Secrets

./args.ts
./provider.ts
./config.ts

oci-get-status.ts -p DEFAULT

oci-manage-adb.ts -p DEFAULT -w ./templates/odbvue.yaml -a list
oci-manage-adb.ts -p DEFAULT -w ./templates/odbvue.yaml -a plan
oci-manage-adb.ts -p DEFAULT -w ./templates/odbvue.yaml -a apply
oci-manage-adb.ts -p DEFAULT -w ./templates/odbvue.yaml -a destroy
oci-manage-adb.ts -p DEFAULT -w ./templates/odbvue.yaml -a wallet -o ./wallets/odbvue.zip

package.json scripts 
---

