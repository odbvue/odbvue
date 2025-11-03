# GitHub Actions CI/CD

## Concepts

**CI (Continuous Integration)** automatically tests and validates code changes on every push. It catches bugs early and ensures code quality before merging.

**CD (Continuous Deployment)** automatically builds, packages, and deploys code to production after successful tests.

**GitHub Actions** is GitHub's automation platform that runs workflows (automated processes) triggered by events like pushes, pull requests, or tags. Each workflow contains jobs (units of work), which contain steps (individual commands).

## Workflow Diagram

```
Feature Branch Development
          ↓
    Merge to main
          ↓
    Changesets Workflow
    (version bump + changelog)
          ↓
    Create Git Tag (v1.2.3)
          ↓
    Build & Package on Tag
    (build app, build DB artifact, create bundle)
          ↓
    Manual/Auto Trigger Deploy
          ├→ Fetch Bundle
          ├→ Deploy DB (SQLcl project deploy)
          └→ Deploy Web (blue/green to server)
```

## Workflows

### 1. **Changesets**

#### `./.github/workflows/changesets.yml`

::: details source
<<< ../../../../.github/workflows/changesets.yml
:::

**Trigger:** On push to `main`

Automatically manages versioning and changelog. After a merge to `main`:
- **Steps:**
  1. Checkout code and install dependencies
  2. Check for pending changesets (version descriptions committed with PRs)
  3. If found: run `pnpm changeset version` to bump version numbers and update `CHANGELOG.md`
  4. Commit and push version changes back to `main`

**Purpose:** Eliminates manual version management; keeps releases synchronized.

### 2. **Build & Package on Tag**

#### `./.github/workflows/release-tag.yml`

::: details source
<<< ../../../../.github/workflows/release-tag.yml
:::

**Trigger:** On push of a tag matching `v[0-9]+.[0-9]+.[0-9]+` (e.g., `v1.2.3`)

Creates release artifacts for deployment.

- **Job: `build`**
  1. Checkout code
  2. Setup SQLcl → Generate database artifact (ZIP) with versioning
  3. Setup Node/pnpm → Build Vue app (`pnpm build`)
  4. Build wiki documentation (`pnpm wiki:build`)
  5. Assemble bundle: combine app, wiki, main, and DB artifact into single tarball
  6. Generate SHA256 checksum for verification
  7. Upload artifacts to GitHub Release

**Purpose:** Creates immutable, verified release packages ready for deployment.

### 3. **Deploy**

#### `./.github/workflows/deploy.yml`

::: details source
<<< ../../../../.github/workflows/deploy.yml
:::

**Trigger:** Manual via `workflow_dispatch` OR auto-triggered after successful `Build & Package on Tag`

Deploys the release to production.

- **Job: `fetch-bundle`**
  - Downloads release bundle (either from workflow artifacts or GitHub Release)
  - Verifies SHA256 checksum before extraction
  - Outputs bundle path and tag for downstream jobs

- **Job: `deploy-db`** (depends on `fetch-bundle`)
  1. Download bundle
  2. Setup SQLcl
  3. Extract and verify database artifact
  4. Restore ADB wallet from secrets
  5. Deploy DB using SQLcl: `project deploy` (applies DDL/DML from artifact)
  6. Tag deployment with version

- **Job: `deploy-web`** (depends on `fetch-bundle` + `deploy-db`)
  1. Extract bundle
  2. For each site (apps, wiki, main):
     - Get current active slot (blue or green)
     - Deploy to inactive slot
     - Atomically flip symlink to switch slots (zero downtime)
     - Fix permissions for nginx
  3. Validate nginx config and reload

**Purpose:** Zero-downtime deployment with database versioning and atomic cut-over.

## Key Features

- **Automated versioning:** Changesets workflow keeps versions in sync with changelog
- **Release verification:** SHA256 checksums ensure bundle integrity
- **Database versioning:** Tagged database deployments with SQLcl project (Liquibase) tagging
- **Blue/green deployment:** Zero-downtime web updates via atomic symlink flip
- **Concurrency control:** Deploy workflows serialize by tag to prevent race conditions
- **Manual override:** Deploy workflow can be triggered manually for any released tag
