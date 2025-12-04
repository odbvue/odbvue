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

A **tag** marks specific commits as release points (e.g., `v1.0.0`) in Git history - important for versioning and rollback.

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

## CLI

The **`ov` CLI** is a command-line tool that automates and streamlines the development workflow for the OdbVue project. It provides commands for managing feature branches, committing changes, exporting database objects, staging changesets, and publishing releases.

> [!IMPORTANT]
> Before using the `ov` CLI, you must build and register it globally:
> ```bash
> cd cli
> pnpm install
> pnpm build
> pnpm link -g
> ```
> After linking, the `ov` command will be available globally in your terminal.

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

> [!NOTE]
> For SQLcl project to export objects of only particular schema, need to set up filter in `./db/.dbtools/filters`
> ```ini
> -- Limit to ODBVUE schema only
> owner = 'ODBVUE',
> ```

> [!TIP]
> For SQLcl project to export table partitions set `"partitioning" : true` in `./db/.dbtools/project.config.json`

> [!TIP]
> SQLcl project export format can be adjusted in `./db/.dbtools/project.sqlFormat.xml`

## Development

### Step 1. Create a feature branch

#### `ov new-feature [feature-name]` or `ov nf [feature-name]`

```bash
ov nf my-feature
```

This command:
- Checks for unmerged changes and exits if any exist
- Checks out and pulls the latest `main` branch
- Creates and checks out a new branch `feat/my-feature`

> [!IMPORTANT]
> Commit or stash any changes before running this command.

### Step 2. Implement application changes

Work on the feature in the feature branch. Commit regularly using the commit-all command:

#### `ov commit-all` or `ov ca`

```bash
ov ca
```

You'll be prompted to:
- Provide a scope (e.g., `apps`, `db`, `chore`, `cicd`)
- Provide a commit message

Result: Creates a commit with message format `(${scope}): ${message}`

### Step 2a. Implement database DDL changes (if needed)

DDL - Data Definition Language - create and alter database objects like table structure, packages

Do development directly in development database. When done:

#### `ov db-export [-c, --connection <connection>]` or `ov de`

```bash
ov de -c user/password@dbhost
```

This command exports database objects using SQLcl project export. The `ODBVUE_DB_CONN` environment variable can be used instead of providing `-c` option.

> [!NOTE]
> Verify the exported database objects are correct before proceeding.

### Step 2b. Implement database DML changes (if needed)

DML - Data Manipulation Language - insert and update data scripts  

Create SQL script file placeholder for the next changeset:

#### `ov db-add-custom [path-to-file]` or `ov da`

```bash
ov da db/src/database/001_insert_data.sql
```

This stages custom database files using SQLcl project staging.

> [!NOTE]
> Scripts will be executed in alphabetic order: `001_*`, `002_*` and so on

### Step 3. Prepare Pull Request

When feature is ready, stage database changes and create a changeset:

#### `ov submit-pr [-c, --connection <connection>]` or `ov sp`

```bash
ov sp -c user/password@dbhost
```

This command:
- Stages database changes using SQLcl project stage
- Prompts for confirmation
- Stages all database changes with `git add db/`
- Prompts to create a changeset (choose version bump: patch, minor, or major)
- Commits all changes with changeset summary
- Pushes to origin with upstream tracking

### Step 4. Merge Pull Request

Then on GitHub:

- Open a PR against `main`
- Request reviews
- Address feedback and push updates (use `ov ca` to commit changes)
- Merge into `main`

### Step 5. Close the feature

#### `ov close-feature` or `ov cf`

```bash
ov cf
```

This command:
- Checks out and pulls the latest `main` branch
- Squash merges the current feature branch into `main`
- Pushes to origin
- Deletes the local and remote feature branch

## Release

Create and publish release

#### `ov create-release` or `ov cr`

```bash
ov cr -m "Release notes message"
```

This command:
- Checks out and pulls the latest `main` branch
- Reads version from `apps/package.json`
- Creates database release using SQLcl project release (if db directory exists)
- Stages all changes with `git add .`
- Commits with message format `release: [version] [additional-message]`
- Creates annotated git tag with format `v[version]`
- Pushes tag and commits to origin for deployment or distribution

> [!NOTE]
> The `-m, --message` option is optional and adds additional context to the release commit and tag.
