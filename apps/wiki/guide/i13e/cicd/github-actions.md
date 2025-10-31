# GitHub Actions

## Overview

### What is GitHub Actions?

GitHub Actions is a continuous integration and continuous deployment (CI/CD) platform built directly into GitHub. It automates your software development workflow by running jobs in response to events in your repository. In OdbVue's case, it automates building and deploying your applications to Oracle Cloud Infrastructure whenever you release a new version.

GitHub Actions workflows are defined as YAML files in your repository's `.github/workflows/` directory. They are triggered by repository events (such as pushes, pull requests, or tags) and execute a series of steps to build, test, and deploy your code.

## OdbVue Workflows

OdbVue uses three primary workflows to automate the release and deployment process:

### 1. Changesets (`changesets.yml`)

**Purpose**: Automate version management and changelog generation.

**Trigger**: Automatically runs on every push to `main` branch, or manually via workflow dispatch.

**What it does**:
- Reads changeset files from `.changeset/` directory
- Bumps version numbers based on semantic versioning (patch, minor, major)
- Updates `CHANGELOG.md` with release notes
- Pushes the version bump and changelog back to the repository
- Cleans up changeset files after processing

**Workflow**:
```
1. Checkout repository
2. Setup pnpm and Node.js environment
3. Install dependencies with frozen lockfile
4. Configure Git for commits
5. Run: pnpm changeset version
   ├─ Bumps version in package.json
   ├─ Generates/updates CHANGELOG.md
   └─ Removes processed .changeset/*.md files
6. Commit and push version bump back to main
```

**Key configuration**:
- Runs on `main` branch pushes
- Uses GitHub Actions bot account for commits
- Uses `secrets.GITHUB_TOKEN` for authentication

**When to use**: Automatically triggered as part of your release process. No manual intervention needed after you merge your feature branch. We do not publish to npm in this repository.

---

### 2. Build & Package on Tag (`release-tag.yml`)

**Purpose**: Build and package the application for release when a version tag is created.

**Trigger**: Automatically runs when a Git tag matching `v[0-9]+.[0-9]+.[0-9]+` (e.g., `v1.0.0`) is pushed.

**What it does**:
- Generates the database artifact (SQL scripts packaged as ZIP)
- Builds the Vue.js application for production
- Builds the VitePress documentation site
- Assembles everything into a single release bundle (TAR.GZ)
- Generates SHA256 checksum for integrity verification
- Uploads artifacts for use by deployment workflow

**Workflow**:
```
1. Checkout repository at tagged commit
2. Setup Oracle SQLcl
3. Generate DB artifact:
   └─ sql project gen-artifact -name odbvue-db -version <TAG> -format zip
4. Setup pnpm/Node.js
5. Build applications:
   ├─ pnpm install --frozen-lockfile
   ├─ pnpm build (apps)
   └─ pnpm wiki:build (documentation)
6. Assemble bundle:
   ├─ Copy apps/dist/ → bundle/apps/
   ├─ Copy wiki/.vitepress/dist/ → bundle/wiki/
   ├─ Copy main/* → bundle/main/
   ├─ Copy db artifact → bundle/db/
   └─ Create: release-<TAG>.tar.gz
7. Generate checksum:
   └─ Create: release-<TAG>.sha256
8. Upload artifacts to GitHub
```

**Output artifacts**:
- `release-v1.0.0.tar.gz` - Complete release bundle (all apps, wiki, main, database)
- `release-v1.0.0.sha256` - SHA256 checksum for integrity verification

**Bundle structure**:
```
release-v1.0.0/
├── apps/              # Vue.js application (dist)
├── wiki/              # VitePress documentation (dist)
├── main/              # Static main page
└── db/
    └── odbvue-db-v1.0.0.zip    # Database artifact (SQL scripts)
```

---

### 3. Deploy (`deploy.yml`)

**Purpose**: Deploy the built artifacts to production environments.

**Trigger**: 
- Manually via workflow dispatch (provide tag as input)
- Automatically when "Build & Package on Tag" workflow completes successfully

**Trigger configuration**:
```yaml
on:
  workflow_dispatch:
    inputs:
      tag:
        description: "Tag to deploy (e.g., v1.2.3)"
        required: true
        type: string
  workflow_run:
    workflows: ["Build & Package on Tag"]
    types: [completed]
```

> [!NOTE]
> On manual runs (workflow_dispatch), the workflow fetches the release bundle by tag from the GitHub Release assets. On automatic runs (workflow_run), it downloads the artifact from the associated build run.
> Automatic deployment only proceeds when the Build & Package workflow concludes successfully.

> [!NOTE]
> Concurrency: Deploy runs are serialized per tag. Manual runs group on the provided tag; automatic runs group on the originating tag (or unique run id as a fallback), preventing unrelated deployments from blocking each other.

**What it does**:

The deployment process is split into three jobs that run sequentially:

#### Job 1: `fetch-bundle`
- Downloads the release bundle
   - If auto-triggered: from the Build workflow artifacts for the associated run
   - If manual: from the GitHub Release assets for the provided tag
- Verifies bundle integrity by checking the `.sha256` checksum file
- Outputs bundle path for dependent jobs

#### Job 2: `deploy-db`
- Extracts database artifact from bundle
- Restores Oracle Autonomous Database wallet credentials
- Performs smoke test (verifies database connection)
- Deploys SQL scripts to production database using SQLcl:
  ```bash
  sql user/password@ADB_TNS_ALIAS
  project deploy -file odbvue-db-v1.0.0.zip
  exit
  ```

#### Job 3: `deploy-web`
- Runs only after database deployment succeeds
- Sets up SSH connection to web server
- Extracts web artifacts from bundle
- **Blue/Green deployment strategy**:
  ```
  1. Determine which slot (blue/green) is currently active
  2. Deploy to inactive slot:
     ├─ Clean inactive directory
     ├─ Upload new content via rsync
     ├─ Fix file permissions (nginx ownership)
     └─ Atomically switch symlink: /current → /green (or /blue)
  3. Validate nginx configuration
  4. Reload nginx (zero-downtime)
  5. Repeat for all sites: apps, wiki, main
  ```

**Deployment architecture**:
```
Production Server
├── /var/www/apps/
│   ├── blue/        (previous version)
│   ├── green/       (new version)
│   └── current → green  (symlink, atomically switched)
├── /var/www/wiki/
│   ├── blue/
│   ├── green/
│   └── current → blue
└── /var/www/main/
    ├── blue/
    ├── green/
    └── current → blue
```

**Blue/Green benefits**:
- Zero-downtime deployments
- Instant rollback (flip symlink back to previous slot)
- Old version remains in place for comparison
- nginx only reloaded after verification

**Required secrets** (configured in GitHub repository settings):

Secrets are referenced in workflows using the format: `secrets.SECRET_NAME`

- `ADB_WALLET_BASE64` - Base64-encoded Oracle ADB wallet ZIP
- `ADB_WALLET_PASSWORD` - Password to decrypt wallet
- `ADB_USER` - Oracle database user
- `ADB_PASSWORD` - Oracle database password
- `ADB_TNS_ALIAS` - Oracle TNS alias/connection name
- `SSH_PRIVATE_KEY` - SSH private key for web server access
- `SSH_HOST_KEY` - SSH host public key fingerprint
- `SSH_USER` - SSH user account (e.g., deploy user)
- `SSH_HOST` - Web server hostname/IP

---

## Complete Release Process

The three workflows work together to create a complete CI/CD pipeline:

```
1. Developer creates feature branch
   └─ feat/my-feature

2. Developer commits changes and creates PR
   └─ Main branch auto-checks pass

3. Developer merges PR to main
   └─ Triggers: changesets.yml

4. Changesets workflow runs
   ├─ Bumps version (e.g., 1.0.0 → 1.1.0)
   ├─ Updates CHANGELOG.md
   └─ Commits changes back to main

5. Release manager creates version tag
   └─ git tag -a v1.1.0 -m "Release 1.1.0"
   └─ git push origin v1.1.0

6. Tag push triggers: release-tag.yml
   ├─ Builds database artifact
   ├─ Builds web applications
   ├─ Assembles release bundle
   └─ Uploads artifacts to GitHub

7. Release complete, ready for deployment

8. Deployment manually triggered (by tag) or automatic (after successful build)
   └─ Triggers: deploy.yml

9. Deploy workflow runs
   ├─ Downloads bundle from build artifacts or Release assets (by tag)
   ├─ Validates checksum (.sha256) before extraction
   ├─ Deploys database changes to ADB
   ├─ Deploys web applications (blue/green)
   └─ Validates and reloads web server

10. Production updated with zero-downtime

### Manual deployment by tag

You can deploy a specific version manually:

1. Ensure a build has been performed for the tag (push a tag like `v1.2.3` to trigger the build). The build workflow publishes the bundle as GitHub Release assets on that tag.
2. Run the Deploy workflow manually and provide the tag (e.g., `v1.2.3`).
3. The workflow will download `release-<TAG>.tar.gz` (and `.sha256`) from the Release assets and proceed with DB and web deployment.

If the release assets don’t exist for the tag, re-run the build workflow by pushing the tag or creating the release assets, then re-run the manual deploy.
```
