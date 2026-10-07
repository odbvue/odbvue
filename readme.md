# OdbVue

**Business logic in TypeScript. Oracle as the runtime. Vue for the experience.**

OdbVue is a framework for building business applications on top of [Oracle Database](https://www.oracle.com/database/) and [Vue](https://vuejs.org/). Keep your existing Oracle database running in the background while developing and delivering business logic and the frontend in TypeScript - a modern, type-safe, and fast language, accompanied with great tooling.

## Why OdbVue?

### One Language, Enterprise Runtime

Keep business logic and the frontend in TypeScript, while Oracle provides the transactional foundation, performance, and security. Generated API contracts connect the database to a modern Vue interface.

TypeScript is where you develop. Oracle is where your business logic runs.

### Own Your Technology

AI eliminates the barrier to building systems in-house. With OdbVue, a focused team of 2-3 can own business logic, data, and user experience in one stack, with short feedback loops and no vendor dependency.

Built for simplicity, scalability, and security, OdbVue keeps moving parts few, logic close to the data, and authorization at the API boundary, leaving more room to build what makes your business different.

## From TypeScript to a Running Service

Define the logic and its API together. A basic service looks like this in a new database migration:

```typescript
import {
  defineMigration,
  defineService,
  odbEnv,
  odbLiteral,
  odbPackage,
  odbType,
} from '@odbvue/odb'

const greetings = odbPackage('pck_greetings', (pkg) => {
  const greet = pkg.proc(
    'greet',
    { out: { message: odbType.string() } },
    ({ params: { message }, body }) => {
      body.set(message, odbLiteral('Hello from Oracle'))
    },
  )

  defineService(greet, {
    auth: 'anonymous',
    method: 'GET',
    path: '/greet',
    module: 'greetings',
    basePath: '/greetings',
    response: { message: greet.parameters.message },
  })

  return {}
})

export const migration = defineMigration('00000000000002_greetings', {
  schema: odbEnv.schemaUsername,
}).install(greetings)
```

Then deploy pending migrations to your configured environment:

```bash
ov db-up latest
```

The CLI handles the steps behind the scenes: compile TypeScript, generate SQL and PL/SQL, apply migrations, deploy the ORDS endpoints, and refresh the OpenAPI contract. Oracle runs the service; the web app gets API types from the generated contract.

**Develop in TypeScript. Run a CLI command. Your service is deployed.**

### A Full Meta-Framework

OdbVue brings the surrounding tools into the same workflow:

- **One-command setup:** `ov setup` configures your environment, starts infrastructure, and deploys the latest database migrations.
- **Infrastructure tooling:** Podman and Oracle Cloud Infrastructure (OCI) integrations, with CLI commands to start, stop, and inspect infrastructure.
- **Type-safe Oracle development:** ODB table and query builders, typed interfaces for Oracle packages and functions, and builders for your own business packages, all in TypeScript.
- **Database lifecycle:** migration scaffolding, deployment plans, upgrades, rollbacks, and SQL execution.
- **Connected APIs:** ORDS services, generated OpenAPI contracts, and TypeScript API types for the frontend.
- **Ready-made web components:** Vue and Vuetify with forms, tables, charts, maps, editors, media, and dialogs.
- **Built-in backend capabilities:** authentication, roles and permissions, rate limiting, audit logging, settings, and storage.

## Getting started

### Prerequisites

- [Node.js 24.12+](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation) 
- [Git](https://git-scm.com/downloads)

### Setup

```bash
# Step 1: Clone repository
git clone https://github.com/odbvue/odbvue.git
cd odbvue

# Step 2: Install dependencies and prepare the CLI
pnpm install

# Step 3: Configure, start infrastructure, and deploy the database
ov setup

# Step 4: Start development
pnpm dev
```

> For local development - to run Oracle Data Base locally, install [Podman](https://podman.io/docs/installation) and initialize a Podman machine where required. Allocate at least 4 CPUs and 8 GB of RAM to the Podman environment (recommended).

> For test - we recommend to register for [Free Tier in Oracle Cloud Infrastructure](https://www.oracle.com/cloud/free/).

## Documentation

All documentation lives in the [wiki](wiki/pages/index.md), including getting started, architecture, and database and web development guides.

## Roadmap

### By the End of 2026

- Complete core application capabilities for authentication and administration.
- Deliver one sample business module demonstrating an end-to-end workflow.
- Enable fully automated CI/CD and deployment to Oracle Cloud Infrastructure (OCI) through GitHub Actions.

### 2027

- Target an upgrade to TypeScript 7.1.
- Further milestones: TBD.

## Contributing

OdbVue is in active development, but ready for early adoption. Contributions and feedback are welcome through [GitHub issues](https://github.com/odbvue/odbvue/issues) and [pull requests](https://github.com/odbvue/odbvue/pulls).

Security concerns can also be reported through [GitHub Security](https://github.com/odbvue/odbvue/security), using private vulnerability reporting where available. Please avoid sharing sensitive vulnerability details in public issues.

## License

This project is licensed under the [MIT License](LICENCE).
