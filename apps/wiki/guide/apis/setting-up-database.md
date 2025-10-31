# Setting up Database

## Overview

This project uses **Oacle Autonomous AI Database** and **ORDS** as a full-featured, REST-enabled data platform.

## Concepts

**Oracle Autonomous AI Database** is a next-generation, enterprise-grade database that supports relational, JSON, and NoSQL data models, and not only self-drives, self-secures, and self-repairs by automating tuning, patching, backups, and scaling, but also includes out-of-the-box AI capabilities - such as natural language querying, in-database machine learning, and vector search for generative AI integration - enabling developers and analysts to build and run intelligent, data-driven applications directly within the database.

It supports **SQL** for querying and data manipulation, along with **PL/SQL (Procedural Language/SQL)** — Oracle’s proprietary procedural extension to SQL that enables developers to implement complex business logic directly within the database. **PL/SQL** provides robust programming capabilities, allowing efficient, secure, and high-performance execution of application logic close to the data.

**Oracle REST Data Services (ORDS)** is a mid-tier application that provides a RESTful web service interface for Oracle Database. It allows developers to easily expose database objects as REST APIs without needing to write custom backend code, leveraging Oracle’s authentication, authorization, and security features.

**Together, Oracle Database and ORDS** turn the database into a full-featured, REST-enabled data platform for modern application development, combining powerful data management, procedural logic with PL/SQL, and RESTful integration capabilities.

**Oracle SQLcl** (SQL Command Line) is a modern command-line interface for Oracle Database that extends the traditional SQL*Plus tool with enhanced features such as scripting, command history, JSON and CSV output, MCP, Liquibase integration, and support for SQLcl Projects to manage database CI/CD workflows.

::: details NOTE
> Using PL/SQL for business logic can be a good idea, but it depends on several factors. Here are some points to consider:
>
> **Advantages**
>
> 1. **Performance**: PL/SQL is processed by the Oracle Database, which can lead to faster execution compared to application server processing, especially for data-intensive operations.
> 2. **Data Integrity**: By encapsulating business logic in the database, you can enforce data integrity and business rules directly where the data resides.
> 3. **Centralization**: Having business logic in PL/SQL centralizes the logic in the database, making it easier to manage and maintain, especially in environments with multiple applications accessing the same database.
> 4. **Reduced Network Traffic**: Since operations are done in the database, there's less need to transfer data back and forth between the application server and the database, which can improve performance for certain types of applications.
>
> **Disadvantages**
>
> 1. **Tight Coupling with Database**: Business logic in PL/SQL ties your application closely to Oracle Database, which can limit flexibility and make it harder to switch databases or use multiple databases.
> 2. **Skill Set Requirements**: Writing and maintaining PL/SQL requires specialized knowledge, which might not be as widely available as skills for other programming languages.
> 3. **Scalability and Load Balancing**: Scaling applications that rely heavily on database-side logic may require additional planning and tuning to ensure performance remains consistent as load increases.
> 4. **Testing and Debugging**: Testing PL/SQL logic can sometimes be less straightforward than testing application-layer code, though modern tools and frameworks have improved this process significantly.
>
> **Conclusion**
>
> Deciding whether to **implement business logic in PL/SQL** depends on your application’s needs, team expertise, and architecture. When performance, data integrity, and centralized rule enforcement are key, PL/SQL can offer clear advantages comparing to other available options.
:::

## Development lifecycle

Historically, managing database changes was a tedious and error-prone process - DBAs and developers had to manually track schema updates, synchronize scripts across environments, and ensure consistency during deployments. This often led to versioning issues, missed dependencies, and time-consuming rollbacks. 

Now, with Oracle’s **SQLcl Project** feature - built on Liquibase - teams get all the benefits of modern CI/CD practices for databases.

### Prerequisites

1. Oracle databases up and running 

- **local development** in Podman container

- **test / prod** in Oracle Cloud Infrastructure

2. **SQLcl** installed locally

> [Enabling Oracle Autonomous Database for Local Development](../../guide/i13e/local-development/database.md)
>
> [Enabling Oracle Autonomous Database in Oracle Cloud Infrastructure](../../guide/i13e/oci/manage.md)
>
> [Download and install SQLcl Locally](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/) installed locally

### Workflow

Development lifecycle overview using **SQLCl project** capabilities.

```
                               ┌────────────────────────────────────────┐
                               │              Developer                 │
                               │  Works in DEV schema using SQLcl,      │
                               │  modifies tables/packages/procedures.  │
                               └─────────────────┬──────────────────────┘
                                                 │
                                                 │ 1) Export changes to project
                                                 ▼
                           ┌────────────────────────────────────────┐
                           │           SQLcl Projects               │
                           │  project stage / export / release      │
                           │  Creates versioned artifact ZIP        │
                           └─────────────────┬──────────────────────┘
                                             │
                                             │ 2) Commit + push changes
                                             ▼
                          ┌────────────────────────────────────────┐
                          │              Git Repository            │
                          │   Feature branch → PR → Merge to main  │
                          │   → Tag/Release created (vX.Y.Z)       │
                          └─────────────────┬──────────────────────┘
                                            │
                                            │ 3) GitHub Actions workflow triggered
                                            ▼
      ┌────────────────────────────────────────────────────────────────────────┐
      │                         GitHub Actions CI/CD                           │
      │                                                                        │
      │  on: push(tag=v*) or release                                           │
      │                                                                        │
      │  jobs:                                                                 │
      │    ├─ deploy_db   → Deploys DB artifact to OCI Autonomous Database     │
      │    │                (uses SQLcl Projects / Liquibase)                  │
      │    │                                                                   │
      │    └─ deploy_app  → Deploys app code to OCI Compute VM                 │
      │                     (Kubernetes, or standalone Webserver)              │
      │                                                                        │
      └────────────────────────────────────────────────────────────────────────┘
```

## Step By Step (first release)

The first release wIll create and deploy a new schema

### Step 1. Check that SQLcl is installed

```bash
sql -v
# SQLcl: Release 25.3.0.0 Production Build: 25.3.0.274.1210
```

### Step 2. Check connection

Check that you can connect as admin and create saved connection to local development database

```bash
sql admin/************@127.0.0.1:1521/myatp
alias save admin
```

### Step 3. Create project

From project's root directory

```bash
mkdir -p db/src/bootstrap
cd db
sql /nolog
project init -name odbvue-db
exit
```

### Step 4. Create user creation script

#### `./db/src/bootstrap/001_create_user_odbvue.sql`

::: details source
<<< ../../../../db/src/bootstrap/001_create_user_odbvue.sql
:::

### Step 5. Deploy script locally

```bash
sql admin/************@127.0.0.1:1521/myatp
@./src/bootstrap/001_create_user_odbvue.sql MySecureUserPass123!
exit
```

### Step 6. Commit changes

```bash
git add *.*
git commit -m "db bootstrap"
git push
```

## CI/CD

### Step 1. Create DB release

```bash
cd db
sql /nolog
project release -version v0.1.26
project gen-artifact -version v0.1.26
exit
```

### Step 2. Commit changes

```bash
git add .
git commit -m "db release"
git push
```

### Step 3. Create GitHub Secrets for DB Deployment

1. Convert Database Wallet to Base64

2. Create Github secrets.

Go to **repository** -> **Settings** -> **Secrets and variables** -> **Actions** and add:

```ini
ADB_USER=ADMIN
ABD_PASSWORD=MySecurePass123!
ADB_WALLET_BASE64=ass...
ADB_WALLET_PASSWORD=MySecurePass123!
ADB_TNS_ALIAS=odbvue_tp 
```

3. Modify Github Actions pipeline

#### `@./.github/workflows/deploy.yml`

:::details source

:::

4. Modify release scripts

#### `@./release.sh`

:::details source

:::

//todo