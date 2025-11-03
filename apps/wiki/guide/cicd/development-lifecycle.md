# Development lifecycle

## Concepts

A **repository** is a central storage location for a project's code, configuration files, documentation, and version history. It can be hosted on platforms like GitHub, GitLab, or Bitbucket.

**Git** is a distributed version control system that tracks changes to files and enables multiple developers to collaborate on the same codebase simultaneously. It records the full history of commits and allows branching, merging, and rollback.

A **branch** is an independent line of development within a repo. It allows developers to work on features, fixes, or experiments without affecting the main codebase (`main` branch).

A **commit** is a snapshot of code changes saved to the repository, often tied to a message describing what was modified and why.

**Changesets** (*Changesets* tool by Atlassian) help track and version changes across a monorepo. They define what changed, where, and how version numbers or changelogs should be updated before release.

A **pull request** (GitHub) or **merge request** (GitLab) is a proposal to merge code from one branch into another. It’s where code review, testing, and discussion occur before integration.

**Code review** is the peer-review process of examining code in a PR to ensure quality, readability, performance, and adherence to team standards.

A **release** is a packaged version of your software (often with version tags like `v1.2.3`) that’s published for users, often accompanied by a changelog and release notes.

A **tag** marks specific commits as release points (e.g., `v1.0.0`) in Git history — important for versioning and rollback.

## Process Overview

//todo

## Initial setup (once)

### Step 1. Init git repo (if not done yet)

```bash
git init
git config core.autocrlf input
git config user.name "Your Name"
git config user.email "your.email@example.com"
```

> [!TIP]
> Add `.gitattributes` file to project root folder with `* text eol=lf`

### Step 2. Install and initialize the changesets tool

```bash
pnpm add -D @changesets/cli
pnpm changeset init
```

### Step 3. Initialize Database Project

> [!NOTE]
> This can be done at later stage of project, when database development starts
>
> Prerequisite: SQLcl is installed
>
> **SQLcl project** feature lets organize SQL scripts, DDL files, and configuration into a structured workspace - it helps to manage, version, and run database scripts more easily by grouping related files, tracking connections and settings, and supporting repeatable deployments or automation workflows.

From the project's root directory

```bash
mkdir db
cd db
sql /nolog
project init -name odbvue-db
# Your project has been successfully created
proj config set -name schemas -value odbvue
# Process completed successfully
!git add .
!git commit -m "db - project init"
exit
cd ..
```

## Developing a feature

### Step 1. Create a feature branch

#### `./scripts/create-feature.sh [feature-name]`

```bash
git checkout main
git pull origin main
git checkout -b feat/[feature-name]
```

### Step 2. Implement application changes

Work on feature in the feature branch. Commit regularly.

```bash
git add .
git commit -m "feat(scope): description of change"
```

### Step 2a. Implement database DDL changes (if needed)

DDL - Data definition language - create and alter database object like table structure, packages

Do development directly in development database. When done:

#### `./scripts/db-export.sh [connection-string] [commit-message]`

```bash 
sql connect [connection-string]
project export
!git add .
!git commit -m "db export: [commit-message]"
exit
```


---

# OLD



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
!git add .
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
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
```

> [!IMPORTANT]
> We do NOT publish to npm from this repository. Versioning is used for release notes and artifact tagging only. Tags (vX.Y.Z) are created and pushed manually to control release timing. If the CI versioning step fails, fix the pending changesets and re-run the workflow.

> [!NOTE]
> Tagging policy: create release tags from `main` by default. Only create a temporary `release/x.y.z` branch when you need a stabilization window; in that case, perform QA on that branch and tag from it, then merge back to `main` and delete the release branch.

---
---
---


git checkout -b feat/cicd-db
mkdir db
cd db

sql /nolog
project init -name odbvue-db
# Your project has been successfully created
!git add .
!git commit -m "db init project"

project release -version v0.0.0
!git add .
!git commit -m "db init project release"

000_before_deploy.sql
777_marker.sql
999_after_deploy.sql
install.sql

.gitignore
.env

deploy.sh

release-tag.yml
deploy.yml

changeset

proj config set -name schemas -value odbvue




### Step X. Develop Database

#### creating and altering objects in local db
project export
git add .
git commit

#### inserting and updating data
project stage add-custom -file-name [file-name]
git add .
git commit

### Step X. Stage Database changes

Commits and stages database changes.

#### `./scripts/stage-db.sh [connection-string] [commit-message]`

```bash
#./scripts/stage-db.ps1 "admin/MySecurePass123!@127.0.0.1:1521/myatp" "test staging"
cd db
git add .
git commit "db: [commit-message]"
sql /nolog
> connect [connection-string]
> project stage 
> exit
git add .
git commit "db stage: [commit-message]"
echo "Database changes staged anb committed: [commit-message]"
cd ..
```

### Step X. Create PR

Check if all code is committed, create changeset, push to origin

#### `./scripts/submit-pr.sh`

```bash
cd apps
pnpm changeset
```

You'll be prompted to:

- Choose the version bump type: patch, minor, or major
- Write a concise [summary-of-the-changes]
- Select which packages changed (usually main app)

```bash
git add .
git commit -m "changeset: [summary-of-the-changes]"
git push -u origin feat/your-feature-name
cd ..
```

### Step X. Approve PR

On GitHub - create, review, approve and merge pull request

- Open a PR against `main`
- Request reviews
- Address feedback and push updates
- Ensure CI/CD checks pass

### Step X. Close feature

#### `./scripts/close-feature.sh`

```bash
git checkout main
git pull origin main
git merge --squash [current-branch]
git push
git branch -d [current-branch]
git push origin --delete [current-branch]
echo "Feature closed"
```

### Step X. Release

Create and publish release

#### `./scripts/release.sh [version] [message]`

```bash
git checkout main
git pull origin main

bump json packages version to [version] (remove v prefix)

# todo later: sql /nolog

git add .
git commit -m "release: [version] [message]"

git tag -a [version] -m "Release [version] [message]"
git push origin [version]
```

