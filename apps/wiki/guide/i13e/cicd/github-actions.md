# GitHub Actions# Git

## Quick Release

Shorthand script to deploy new release:

```bash
./scripts/release.sh -v 0.1.9 - m "Release v0.1.9 - Odoroki"
```

::: details `./apps/scripts/release.sh`
<<< ../../../../scripts/release.sh
:::

## Overview

### What is GitHub Actions?

GitHub Actions is a continuous integration and continuous deployment (CI/CD) platform built directly into GitHub. It automates your software development workflow by running jobs in response to events in your repository. In OdbVue's case, it automates building and deploying your applications to Oracle Cloud Infrastructure whenever you release a new version.

### How OdbVue Uses GitHub Actions

The OdbVue deployment workflow is **tag-based**, meaning:

1. **You create a release**: When you're ready to deploy, you create a Git tag (e.g., `v1.5.0`)

2. **GitHub detects the tag**: GitHub Actions automatically triggers when the tag is pushed

3. **Build stage runs**: The workflow builds your Vue.js app and VitePress wiki

4. **Deploy stage runs**: The workflow SSHs into your OCI compute instance and executes the blue/green deployment

5. **Zero-downtime deployment**: Your sites switch to the new version atomically

### Key Benefits

- **Automated**: No manual SSH or script execution needed```

- **Reliable**: Same steps every time, consistent deployments

- **Auditable**: Full history of who deployed what and when## Github Actions

- **Safe**: Integrates with your branching strategy and tag-based releases

- **Fast**: Builds and deploys in ~2-3 minutes

### Architecture Diagram

```
┌─ You: Create release branch and PR ─────────┐
│                                             │
│ 1. git checkout -b release/x.y.z main       │
│ 2. Merge into main                          │
│ 3. git tag -a vx.y.z -m "Release x.y.z"    │
│ 4. git push origin vx.y.z                   │
│                                             │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
         ┌─ GitHub Actions Triggered ─┐
         │                            │
         │ BUILD STAGE:               │
         │ • pnpm install             │
         │ • pnpm build               │
         │ • pnpm wiki:build          │
         │                            │
         └────────┬────────────────────┘
                  │
                  ▼
      ┌─ DEPLOY STAGE ────────────────────┐
      │                                   │
      │ • SSH to OCI instance             │
      │ • Run deploy.sh (blue/green)      │
      │ • Switch to new version           │
      │ • Verify deployment               │
      │                                   │
      └────────┬────────────────────────┘
               │
               ▼
    ┌─ Deployment Complete ─┐
    │                       │
    │ ✓ apps.odbvue.com    │
    │ ✓ wiki.odbvue.com    │
    │ ✓ odbvue.com         │
    │                       │
    └───────────────────────┘
```

---

## Setup Instructions

### Prerequisites

Before setting up GitHub Actions, ensure you have:

- SSH key pair for OCI instance (from OCI setup)
- OCI compute instance running and accessible
- Nginx setup complete on OCI (`./i13e/oci/basic/scripts/setup.sh` executed)
- SSH key added to OCI instance `.ssh/odbvue`

### Step 1: Generate or Retrieve Your SSH Private Key

If you don't have an SSH key, generate one:

```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/odbvue -N ""
```

The key files will be created:
- `~/.ssh/odbvue` (private key)
- `~/.ssh/odbvue.pub` (public key)

Add the public key to your OCI instance (already done during `setup.sh` if using Terraform).

### Step 2: Create GitHub Secrets

GitHub Actions securely stores deployment credentials as "secrets" that workflows can reference without exposing them in logs or version control.

**Steps:**

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add the following secrets:

| Secret Name | Value | Notes |
|---|---|---|
| `SSH_PRIVATE_KEY` | Contents of `~/.ssh/odbvue` | Entire private key file, including `-----BEGIN RSA PRIVATE KEY-----` header |
| `SSH_HOST` | Your OCI public IP | e.g., `203.0.113.45` |
| `SSH_USER` | SSH user on OCI instance | Usually `opc` for Oracle Linux 9 |

**Example for SSH_PRIVATE_KEY:**

```
-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA1234567890abcdefg...
[rest of key contents]
...abcdefghijklmnop1234567890
-----END RSA PRIVATE KEY-----
```

### Step 3: Add SSH Known Host Key

To prevent SSH connection issues, add your OCI instance's host key to GitHub:

```bash
# Get the host key from your OCI instance
ssh-keyscan -H 203.0.113.45 2>/dev/null | grep ssh-rsa
```

Output will look like:
```
203.0.113.45 ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAA...
```

Add as another secret:

| Secret Name | Value |
|---|---|
| `SSH_HOST_KEY` | The full line from ssh-keyscan |

### Step 4: Create Workflow Directory

Create the GitHub Actions workflow directory and file:

```bash
mkdir -p .github/workflows
```

### Step 5: Add Workflow Configuration

Create `.github/workflows/deploy.yml` (see "Workflow Configuration" section below).

---

## Workflow Configuration

Create the file `.github/workflows/deploy.yml` in your repository root:

<<< ../../../../../.github/workflows/deploy.yml

## Version Bumps

### Manual Version Update

Before creating a release tag, manually update the version in `./apps/package.json`:

```json
{
  "name": "odbvue",
  "version": "1.5.0",
  ...
}
```

Update both **major** and **minor** versions as needed. The workflow will automatically include this version in the build.

### Automatic Patch Increments (Optional)

To automatically increment patch versions on every build, add these scripts to `./apps/package.json`:

```json{3,8-9}
{
  "name": "odbvue",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "prebuild": "pnpm version patch --no-git-tag-version",
    "prewiki:build": "pnpm version patch --no-git-tag-version",
    "build": "run-p type-check \"build-only {@}\" --",
    ...
  }
}
```

This will increment the patch version (e.g., `1.5.0` → `1.5.1`) before each build.

---

## Release & Deployment Process

### Complete Step-by-Step Example

Assume you're releasing version `1.5.0`. Follow these steps:

#### Step 1: Update Version

```bash
# In ./apps/package.json, change version to 1.5.0
```

#### Step 2: Create Release Branch

```bash
git checkout main
git pull
git checkout -b release/1.5.0
```

#### Step 3: Commit and Push

```bash
git add apps/package.json
git commit -m "chore(release): v1.5.0"
git push -u origin release/1.5.0
```

#### Step 4: Create Pull Request

Open a PR on GitHub from `release/1.5.0` → `main`. Get it reviewed and approved.

#### Step 5: Merge to Main

Merge the PR into `main` (via GitHub UI or command line). Use **squash merge** to keep history clean.

#### Step 6: Create Release Tag

```bash
git checkout main
git pull
git tag -a v1.5.0 -m "Release v1.5.0 - Feature X improvements, Bug Y fixes"
git push origin v1.5.0
```

#### Step 7: GitHub Actions Runs Automatically

The workflow is now triggered! You can monitor progress:

1. Go to **GitHub → Actions** tab
2. Click the **Deploy OdbVue** workflow run
3. Watch the build and deploy stages complete
4. Check logs if any issues occur

**Typical timeline:**
- Build stage: ~1-2 minutes
- Deploy stage: ~30-60 seconds
- **Total: ~2-3 minutes to deployment**

#### Step 8: Verify Deployment

After the workflow completes successfully, verify your sites:

```bash
# From your local machine
curl https://apps.odbvue.com
curl https://wiki.odbvue.com
curl https://odbvue.com
```

Or SSH into your OCI instance and check:

```bash
ssh opc@203.0.113.45
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
```

---

## Troubleshooting & Rollback

### Common Issues

#### Issue: "SSH Permission Denied"

**Cause:** SSH key not working or not authorized on OCI instance.

**Solution:**

1. Verify SSH key is in `~/.ssh/authorized_keys` on OCI instance:
   ```bash
   ssh opc@203.0.113.45
   cat ~/.ssh/authorized_keys
   ```

2. Verify the public key matches your private key:
   ```bash
   ssh-keygen -y -f ~/.ssh/odbvue
   ```

3. Re-add the public key if needed:
   ```bash
   cat ~/.ssh/odbvue.pub | ssh opc@203.0.113.45 'cat >> ~/.ssh/authorized_keys'
   ```

#### Issue: "Build Fails - pnpm Install Error"

**Cause:** Dependency issues or corrupted `pnpm-lock.yaml`.

**Solution:**

1. Check the GitHub Actions logs for the specific error
2. Try rebuilding locally:
   ```bash
   cd apps
   rm -rf node_modules
   pnpm install
   pnpm build
   ```

3. If successful locally, commit the updated lock file and try deployment again

#### Issue: "Deploy Fails - sites.yaml Not Found"

**Cause:** Deploy scripts not copied correctly to remote.

**Solution:**

1. Manually SSH to OCI instance and check:
   ```bash
   ssh opc@203.0.113.45
   ls -la ~/deploy/
   ```

2. If missing, manually copy:
   ```bash
   scp -i ~/.ssh/odbvue -r i13e/oci/basic/scripts/* \
     opc@203.0.113.45:~/deploy/
   ```

#### Issue: "Deployment Looks Stuck"

**Cause:** Network timeout or DNS issue.

**Solution:**

1. Check the OCI instance is running:
   ```bash
   ssh opc@203.0.113.45 'echo "SSH OK"'
   ```

2. Check nginx is running:
   ```bash
   ssh opc@203.0.113.45 'sudo systemctl status nginx'
   ```

3. Check disk space on OCI instance:
   ```bash
   ssh opc@203.0.113.45 'df -h'
   ```

### Manual Rollback

If a deployment goes wrong, you can rollback to the previous version:

#### Via SSH (fastest)

```bash
ssh opc@203.0.113.45
cd ~/deploy
bash deploy.sh --rollback
```

This flips the symlinks back to the previous blue/green slot.

#### Via Git Tag (redeploy previous version)

If you need to redeploy an older version:

1. List your release tags:
   ```bash
   git tag --list 'v*' | sort -V | tail -10
   ```

2. Trigger deployment of an older version:
   ```bash
   git push origin v1.4.0  # Re-push an old tag
   ```

   GitHub Actions will re-run the workflow for that tag.

#### Via Manual Deploy Script

If GitHub Actions is unavailable, deploy manually:

```bash
# From your local machine
cd i13e/oci/basic/scripts

# Copy everything to remote
bash setup.sh opc@203.0.113.45 ~/.ssh/odbvue

# Copy built artifacts (build locally first)
cd apps
pnpm build
pnpm wiki:build

# Deploy
cd ../../i13e/oci/basic/scripts
bash deploy.sh opc@203.0.113.45 ~/.ssh/odbvue
```

### Monitoring & Logging

#### View GitHub Actions Logs

1. Go to **GitHub → Actions** tab
2. Click the workflow run
3. Click the failed job to see detailed logs
4. Look for error messages in red

#### View OCI Instance Logs

```bash
# SSH to instance
ssh opc@203.0.113.45

# Check nginx error log
sudo tail -50 /var/log/nginx/error.log

# Check nginx access log
sudo tail -50 /var/log/nginx/access.log

# Check system log
sudo journalctl -n 50 -u nginx
```

#### View Deployment Artifacts

Blue/green slots and releases are stored on the OCI instance:

```bash
ssh opc@203.0.113.45

# Check current symlink
ls -la /var/www/apps/current

# List blue/green slots
ls -la /var/www/apps/blue
ls -la /var/www/apps/green

# Check releases if using timestamped releases
ls -la /var/www/apps/blue/
```

---

## Best Practices

1. **Test locally before tagging:**
   ```bash
   cd apps
   pnpm build
   pnpm wiki:build
   ```

2. **Use semantic versioning:**
   - `v1.0.0` for major releases
   - `v1.1.0` for minor features
   - `v1.0.1` for patches/hotfixes

3. **Write clear release messages:**
   ```bash
   git tag -a v1.5.0 -m "Release 1.5.0

   Features:
   - New checkout UI
   - Performance improvements
   
   Fixes:
   - Payment gateway timeout issue
   - Database connection pooling
   
   Breaking Changes:
   - Removed legacy API endpoint"
   ```

4. **Monitor first deployment:** Watch the GitHub Actions run and nginx logs in real-time during your first few deployments

5. **Keep SSH key secure:** Never commit `~/.ssh/odbvue` to version control or share it publicly

6. **Rotate SSH keys periodically:** Generate new keys and update GitHub secrets every 6-12 months
