# CLI Architecture Spec

## Goal

The CLI should scale cleanly across:

- multiple platforms: local Podman, OCI, AWS, and future targets
- multiple service kinds: Oracle ADB, Postgres, web applications, object storage, and future services
- multiple environments: dev, test, prod, and custom environments
- multiple operations: setup, up, down, status, exec, upload, deploy

The current code is organized mostly around individual commands. That works for a small surface area, but it will become hard to extend because command handlers end up owning domain modeling, environment config, platform-specific behavior, and operational logic at the same time.

The recommended direction is to organize the CLI around capabilities and environment reconciliation rather than around today’s concrete commands.

## Problems In The Current Shape

Current pressure points:

- `infra-up` mixes command handling, manifest reading, compose generation, Podman orchestration, readiness checks, and wallet download.
- `db-exec` is presented as a generic database operation, but the implementation is an Oracle ADB-specific execution path.
- `Config` mixes persistence, environment selection, manifest typing, config path concerns, and some domain logic.

This makes every new platform or service combination expensive to add because the behavior gets spread across command files and generic utilities.

## Recommended Architecture

Keep these existing choices:

- Commander for CLI parsing
- YAML for per-environment configuration
- `.env` files for local environment secrets where appropriate

Change the internal organization into four layers.

### 1. CLI Layer

Purpose:

- parse arguments
- define command groups
- validate top-level input
- render human output
- call application use cases

This layer should stay thin. It should not know how Podman, OCI, Oracle DB, or AWS work.

Suggested location:

```text
src/cli/
```

### 2. Application Layer

Purpose:

- orchestrate use cases
- load the selected environment
- resolve services and drivers
- apply desired state
- coordinate operations such as setup, up, status, deploy

Examples:

- run setup wizard
- apply environment
- destroy environment
- get environment status
- execute SQL against a database service
- upload an object to storage
- deploy a web application

Suggested location:

```text
src/app/
```

### 3. Domain Layer

Purpose:

- define typed manifest models
- define service kinds and platform references
- define capability interfaces
- define driver lookup rules

This layer expresses the stable concepts of the CLI, independent of Podman, OCI, or AWS SDK details.

Suggested location:

```text
src/domain/
```

### 4. Adapters / Infrastructure Layer

Purpose:

- implement platform-specific and service-specific behavior
- read and write manifests
- read and write secrets
- wrap SDKs and external tools

Examples:

- Podman runtime
- OCI runtime
- AWS runtime
- Oracle database client wrapper
- manifest repository
- prompts-based setup wizard

Suggested location:

```text
src/adapters/
```

## Proposed Folder Layout

```text
src/
  cli/
    index.ts
    commands/
      setup.ts
      env.ts
      up.ts
      down.ts
      status.ts
      db.ts
      s3.ts
      web.ts
  app/
    setup/
      run-setup-wizard.ts
    environment/
      apply-environment.ts
      destroy-environment.ts
      get-environment-status.ts
    database/
      exec-sql.ts
    storage/
      upload-object.ts
    web/
      build-spa.ts
      deploy-spa.ts
  domain/
    manifest/
      environment-manifest.ts
      service-instance.ts
      platform-ref.ts
    capabilities/
      lifecycle.ts
      status.ts
      database.ts
      object-storage.ts
      web-deploy.ts
    registry/
      service-registry.ts
  adapters/
    config/
      environment-manifest-repo.ts
      current-environment-store.ts
      secrets-store.ts
    prompts/
      setup-wizard.ts
    platforms/
      podman/
        podman-runtime.ts
      oci/
        oci-runtime.ts
      aws/
        aws-runtime.ts
    services/
      oracle-adb/
        local-podman-driver.ts
        oci-driver.ts
      postgres/
        podman-driver.ts
      object-storage/
        oci-driver.ts
        aws-s3-driver.ts
      web-spa/
        local-driver.ts
        aws-driver.ts
  shared/
    logger.ts
    errors.ts
```

## Core Design Principle

Commands should depend on capabilities, not on concrete platforms.

Examples:

- `ov db exec` should resolve the database service for the selected environment and call a database capability.
- `ov s3 upload` should resolve the object storage service for the selected environment and call an object storage capability.
- `ov up` should resolve all enabled services in the environment and call a lifecycle capability on each one.
- `ov status` should ask every service driver for actual runtime state and aggregate the result.

This keeps the CLI command surface stable even when service and platform combinations grow.

## Manifest Model

Keep per-environment files:

- `config/dev/dev.yaml`
- `config/test/test.yaml`
- `config/prod/prod.yaml`

Do not collapse all environments into one giant file.

Instead of a generic `resources` array with loosely typed `spec` objects, move to explicit service instances and named platform definitions.

Recommended shape:

```yaml
platforms:
  local-podman:
    type: podman
    config:
      machineName: odbvue-dev

  oci-main:
    type: oci
    config:
      profile: DEFAULT
      region: eu-frankfurt-1
      compartmentId: ocid1.compartment...

  aws-main:
    type: aws
    config:
      profile: default
      region: eu-central-1

services:
  - id: main-db
    kind: oracle-adb
    platform: local-podman
    enabled: true
    tags: [database, primary]
    config:
      listenerPort: 1522
      ordsPort: 8443

  - id: assets
    kind: object-storage
    platform: oci-main
    enabled: true
    tags: [s3]

  - id: frontend
    kind: spa
    platform: aws-main
    enabled: true
    config:
      buildCommand: pnpm build
      outputDir: dist
```

### Why This Shape Works Better

- Services reference named platforms rather than raw platform strings.
- One environment can contain multiple OCI or AWS targets if needed.
- Service `kind` is explicit and stable.
- `config` stays service-specific without turning the entire manifest into an untyped bucket.
- `enabled` supports partial environments and staged rollouts.
- `tags` help with shorthand targeting later.

Examples of future commands enabled by this model:

- `ov up --only database`
- `ov status --tag primary`
- `ov web deploy frontend`
- `ov db exec main-db "select 1 from dual"`

## Split The Current Config Class

The current `Config` class should be split into focused components.

### CurrentEnvironmentStore

Responsibility:

- get selected environment
- set selected environment

### EnvironmentManifestRepository

Responsibility:

- load environment manifest
- save environment manifest
- list environments

### SecretsStore

Responsibility:

- read secrets for selected environment
- write secrets for selected environment
- isolate `.env` handling from domain modeling

This keeps persistence concerns out of domain models and removes the current “god object” behavior.

## Command Surface

Recommended command surface:

- `ov setup`
- `ov up`
- `ov down`
- `ov status`
- `ov env list`
- `ov env select`
- `ov env show`
- `ov db exec`
- `ov db shell`
- `ov s3 upload`
- `ov s3 ls`
- `ov web build`
- `ov web deploy`

### Command Intent

`ov setup`

- interactive wizard
- edits desired state only
- writes or updates the manifest and secrets

`ov up`

- applies desired state
- provisions or starts enabled services for the selected environment

`ov down`

- tears down managed resources for the selected environment

`ov status`

- shows desired state and actual state side by side

Capability shortcuts such as `db`, `s3`, and `web` should target a resolved service rather than hardcoded implementation logic.

### Important Separation

Do not make `setup` implicitly become the long-term provisioning entry point.

Better model:

- `ov setup` defines desired state
- `ov up` applies desired state

If needed, support:

- `ov setup --apply`

That keeps the mental model simpler.

## Capability Interfaces

Introduce capability interfaces instead of branching everywhere on `resource.type` and `resource.platform`.

Suggested capabilities:

### LifecycleCapability

- `up()`
- `down()`

### StatusCapability

- `status()`

### DatabaseCapability

- `exec(sql)`
- `connectInfo()`

### ObjectStorageCapability

- `upload(source, destination)`
- `list(prefix)`

### WebDeployCapability

- `build()`
- `deploy()`

Commands should resolve a service instance, request the appropriate capability from its driver, and execute it.

## Driver Model

Use service drivers to represent concrete implementations.

Examples:

- `OracleAdbLocalPodmanDriver`
- `OracleAdbOciDriver`
- `PostgresPodmanDriver`
- `OciObjectStorageDriver`
- `AwsS3Driver`
- `SpaAwsDeployDriver`

Each driver advertises the capabilities it supports.

This matters because:

- one service kind may exist on multiple platforms
- one command may target multiple service kinds with the same capability model
- unsupported operations can fail clearly at the driver boundary

## Service Resolution Rules

Shorthand commands should resolve services predictably.

Examples:

- `ov db exec` resolves the primary or explicitly selected database service
- `ov s3 upload` resolves the default or named object storage service
- `ov web deploy` resolves the default or named web service

Recommended resolution order:

1. explicit service id passed on CLI
2. service tagged as `primary`
3. only matching service in the environment
4. otherwise fail with a clear selection error

This is better than baking assumptions directly into command handlers.

## Setup Wizard Behavior

The setup flow should gather and persist desired state, not implement runtime behavior directly.

Recommended setup steps:

1. choose or create environment
2. choose platforms available in this environment
3. define services for this environment
4. collect service-specific config
5. collect required secrets
6. optionally run `up`

This scales better than having separate setup files per current service type once the matrix expands.

## Status Model

`ov status` should become a first-class operation.

It should report at least:

- environment name
- configured services
- enabled or disabled state
- platform target
- desired state
- actual state
- endpoint or connection summaries when available

Example output shape:

```text
Environment: dev

SERVICE    KIND         PLATFORM      DESIRED   ACTUAL      DETAILS
main-db    oracle-adb   local-podman  up        healthy     localhost:1522
assets     object-store oci-main      up        available   bucket ready
frontend   spa          aws-main      up        deployed    https://...
```

This becomes the operational center of the CLI.

## Migration Strategy

Do not rewrite everything at once. Migrate in small steps.

### Step 1

Extract manifest types and persistence from the current `Config` class.

Target outcome:

- `CurrentEnvironmentStore`
- `EnvironmentManifestRepository`
- `SecretsStore`

### Step 2

Make command files thin wrappers.

Target outcome:

- commands call application services
- commands stop owning platform logic

### Step 3

Introduce a service registry and the first capability: lifecycle.

Target outcome:

- `ov up`
- `ov down`
- runtime logic moved to drivers

### Step 4

Move current local Oracle ADB Podman behavior into a dedicated driver.

Target outcome:

- compose generation and readiness checks leave `infra-up`

### Step 5

Move Oracle-specific SQL execution into a database capability driver.

Target outcome:

- `db-exec` stops being hardcoded command logic

### Step 6

Introduce grouped commands:

- `db`
- `s3`
- `web`
- `env`

### Step 7

Rename `resources` to `services` unless low-level infra objects are intentionally modeled separately.

## Suggested Immediate Refactor Targets

The first files to reshape would be:

- current config handling
- current infra orchestration
- current database execution path

That maps to the existing areas where the coupling is already visible.

## Summary

The CLI should be organized around:

- environment manifests as desired state
- services as the main domain concept
- capabilities as the command contract
- drivers as service plus platform implementations
- thin commands that delegate into application use cases

In short:

- `setup` defines desired state
- `up` and `down` reconcile desired state
- `status` reports actual state
- `db`, `s3`, and `web` commands resolve a service and invoke capabilities

That structure will scale much better than continuing to grow command files with platform and service branching.
