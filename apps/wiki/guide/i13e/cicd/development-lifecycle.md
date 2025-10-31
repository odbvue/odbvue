# Development lifecycle

## Concepts

Historically, managing database changes was a tedious and error-prone process - DBAs and developers had to manually track schema updates, synchronize scripts across environments, and ensure consistency during deployments. This often led to versioning issues, missed dependencies, and time-consuming rollbacks. Now, with Oracle’s **SQLcl Project** feature - built on Liquibase - teams get all the benefits of modern CI/CD practices for databases.

**Changesets** is a lightweight tool (by Atlassian, now community-maintained) that helps manage versioning, changelogs, and releases in monorepos as OdbVue. It tracks what changed, where, and how it should affect version numbers - all before you actually publish or deploy - and generates automatic changelog.

## Initial setup (once)

### Step 1. Init git repo (if not done yet)

```bash
git init
git config core.autocrlf true
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

### Step 2. Install and initialize the changesets tool (in `./apps/`)

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

### Step 3. Initialize Database Project

> [!NOTE]
> This can be done at later stage of project, when database development starts
>
> Prerequisite: SQLcl is installed

From the project's root directory

```bash
mkdir -p db
cd db
sql /nolog
project init -name odbvue-db
exit
```

## Development process

### Overview

This section describes the day-to-day workflow for developing features and database changes using the Trunk + Temporary Release Branch strategy with Changesets.

### Step 1. Create a feature branch

```bash
git checkout main
git pull origin main
git checkout -b feat/your-feature-name
```

### Step 2. Implement application changes

Work on your feature in the feat/ branch. Commit regularly:

```bash
git add .
git commit -m "feat(scope): description of change"
```

### Step 3. Implement database changes (optional)

If your feature requires database schema or data changes:

#### For DDL changes (creating and altering schema objects):

Develop in local database:

```bash
sql admin/************@127.0.0.1:1521/myatp

# Make schema changes, test them
-- CREATE TABLE, ALTER TABLE, etc.
exit
```

When done, export and stage the changes:

```bash
cd db
sql /nolog
project export -name <your-feature-name>
project stage <your-feature-name>
!git add db/
!git commit -m "db: description of database change"
exit
```

#### For DML changes (custom data manipulation scripts)

Create SQL script files manually in `db/src/<your-feature-name>` and stage them:

```bash
cd db
sql /nolog
project stage add-custom -file-name ./src/your-feature-name/your-script-name.sql
!git add db/
!git commit -m "db: description of data change"
exit
```

> [!NOTE]
> Scripts will be executed in alphabetic order name `001_*`, `002_*` and so on

### Step 4. Create changeset

```bash
cd apps
pnpm changeset
```

You'll be prompted to:

- Select which packages changed (usually main app)
- Choose the version bump type: patch, minor, or major
- Write a concise summary of the changes

```bash
git add .
git commit -m "changeset: your feature summary"
```

### Step 5. Create and review Pull request

```bash
git push -u origin feat/your-feature-name
```

Then on GitHub:

- Open a PR against `main`
- Request reviews
- Address feedback and push updates
- Ensure CI/CD checks pass

### Step 6. Merge to main

```bash
git checkout main
git pull origin main
git merge --squash feat/your-feature-name
git push

# Clean up
git branch -d feat/your-feature-name
git push origin --delete feat/your-feature-name
```

### Step 7. Create a release (from main)

When ready to release (multiple features can be batched):

1. Merge your PRs to `main`. The CI Changesets workflow will automatically run `pnpm changeset version`, update package versions and `CHANGELOG.md`, and push the commit back to `main`.
2. Create a Git tag matching the new version and push it to trigger the build & package workflow:

```bash
# Create a tag to mark the release (replace with the version from package.json)
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

> [!IMPORTANT]
> We do NOT publish to npm from this repository. Versioning is used for release notes and artifact tagging only. Tags (vX.Y.Z) are created and pushed manually to control release timing. If the CI versioning step fails, fix the pending changesets and re-run the workflow.

> [!NOTE]
> Tagging policy: create release tags from `main` by default. Only create a temporary `release/x.y.z` branch when you need a stabilization window; in that case, perform QA on that branch and tag from it, then merge back to `main` and delete the release branch.