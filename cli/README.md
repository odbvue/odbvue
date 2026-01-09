# OdbVue CLI

Command-line utility for OdbVue project management. Provides tools for local development setup, database operations, feature branching, and release management.

## Installation

The CLI is available as `ov` command after installation:

```bash
npm install  # From project root or cli directory
```

## Commands

### Development

#### `ov dev`
Start all development servers (app, wiki) in parallel for local development.

### Local Database (ADB Free)

Commands for managing a containerized local Oracle Database using Podman.

#### `ov local-db up`
Build and start the local database container. Uses `podman compose up -d --build` under the hood.

#### `ov local-db down`
Stop and remove the local database container. Uses `podman compose down`.

#### `ov local-db logs`
Show recent logs from the running local database container.

#### `ov local-db wallet`
Download the TLS wallet from the local DB container as a zip file.

#### `ov local-setup`
**Interactive guided setup** for local development:
- Starts the local database
- Creates configuration files
- Prepares the app and wiki directories for development

### Database Management

#### `ov db-install-local` | `dil`
Install or upgrade the schema and database objects into the local DB. Uses files from `db/dist` and configuration from `db/.config.json`.

#### `ov db-export` | `de`
Export database objects and automatically commit changes to git.

#### `ov db-add-custom <file>` | `da`
Stage a custom database file for deployment.

#### `ov db-scaffold [path]` | `ds`
Generate SQL scripts from TypeScript module API definitions. Scans the current directory if no path is provided.
- When run in a module's `api/` directory, generates SQL from exported table and package definitions
- Creates `index.sql` in `./dist` directory
- Optional: Prompts to execute the generated script via SQLcl

### Feature Workflow

#### `ov new-feature <name>` | `nf`
Create a new feature branch with naming convention `feat/<name>`.

#### `ov close-feature` | `cf`
Close the current feature branch with a squash merge back to main.

### Git & Commits

#### `ov commit-all <scope> <message>` | `ca`
Add and commit all changes with a conventional commit format.
- `<scope>`: Feature area (e.g., `crm`, `api`, `cli`)
- `<message>`: Concise description of changes

### Pull Requests & Releases

#### `ov submit-pr` | `sp`
Submit a pull request with database changes and changeset information.

#### `ov create-release` | `cr`
Create and publish a new release with version bumping and changelog generation.

## Configuration

The CLI loads environment variables from:
1. `.env` (CLI directory) - highest priority
2. `.env` (project root)

See `.env.example` for available configuration options.

## Common Workflows

### Local Development Setup
```bash
ov local-setup
ov dev
```

### Creating a Feature
```bash
ov new-feature my-feature
# Make changes...
ov db-scaffold  # Generate SQL if working with DB objects
ov commit-all crm "add new person fields"
ov submit-pr
ov close-feature
```

### Generating Database Schema
```bash
cd apps/src/modules/crm/api
ov ds
# Review generated SQL in ./dist/index.sql
```

## Shell Scripts

Convenient wrapper scripts are provided:

- **Linux/macOS**: `./ov.sh [command]`
- **Windows PowerShell**: `./ov.ps1 [command]`

## Help

```bash
ov --help          # Show all commands
ov <command> --help # Show command-specific options
```
