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

1. **Initial Setup (once)**
   Set up the Git repository, initialize the Changesets tool, and configure the database project using SQLcl.

2. **Create a Feature Branch**
   Start new work by branching from `main` - named `feat/[feature-name]`.

3. **Develop and Commit Changes**
   Implement the feature or fix, committing changes regularly with clear messages.

4. **(Optional) Apply Database Changes**
   For database updates, export DDL or create DML scripts with SQLcl project and commit them.

5. **Prepare Pull Request**
   Finalize changes, generate a changeset (for version tracking), and push your branch.

6. **Submit and Review PR**
   On GitHub ppen a pull request to `main`. Peers review, test, and approve before merging.

7. **Close Feature Branch**
   After merging, clean up the branch locally and remotely.

8. **Release**
   Tag a new version, commit release notes, and push to origin for deployment or distribution.

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

## Development

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

DDL - Data Definition Language - create and alter database object like table structure, packages

Do development directly in development database. When done:

#### `./scripts/db-export.sh [commit-message] [connection-string]`

```bash 
cd db
sql [connection-string]
project export
!git add .
!git commit -m "feat(db): [commit-message]"
exit
cd ..
```

### Step 2b. Implement database DML changes (if needed)

DML - Data Manipulation Language - insert and update data scripts  

Create SQL script files manually in `db/src/<your-feature-name>` and stage:

#### `./scripts/db-add-custom.sh [path-to-file] [commit-message]`

```bash
cd db
sql /nolog
project stage add-custom -file-name [path-to-file]
!git add .
!git commit -m "feat(db): [commit-message]"
exit
cd ..
```

> [!NOTE]
> Scripts will be executed in alphabetic order name `001_*`, `002_*` and so on

### Step 3. Create Pull Request

When feature is ready:

#### `./scripts/submit-pr.sh [connection-string]`

```bash
cd db
sql [connection-string]
project stage 
exit
cd ..

cd apps
pnpm changeset
```

You'll be prompted to:

- Choose the version bump type: patch, minor, or major
- Write a concise summary of the changes

```bash
git add .
git commit -m "changeset: [changeset-summary]"
git push -u origin feat/feat/[feature-name]
cd..
```

### Step 4. Merge Pull Request

Then on GitHub:

- Open a PR against `main`
- Request reviews
- Address feedback and push updates
- Merge into `main`

### Step 5. Close the feature

#### `./scripts/close-feature.sh`

```bash
# [current-branch] git rev-parse --abbrev-ref HEAD
git checkout main
git pull origin main
git merge --squash [current-branch]
git push
git branch -d [current-branch]
git push origin --delete [current-branch]
```

## Release

Create and publish release

#### `./scripts/release.sh [version] [message]`

```bash
git checkout main
git pull origin main

# bump json packages version to [version] (remove v prefix)

cd db
sql /nolog
project release -version [version]
exit
cd ..

git add .
git commit -m "release: [version] [message]"

git tag -a [version] -m "Release [version] [message]"
git push origin [version]
git push
```
