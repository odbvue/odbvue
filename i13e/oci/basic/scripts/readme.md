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
