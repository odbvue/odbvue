# Setting up Database

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
> **Disclaimer**
>
> Deciding whether to **implement business logic in PL/SQL** depends on your application’s needs, team expertise, and architecture. When performance, data integrity, and centralized rule enforcement are key, PL/SQL can offer clear advantages comparing to other available options.
:::

## Prepare Environment

1. [Enable Oracle Autonomous Database for Local Development](../../guide/i13e/local-development/database.md)

2. [Enable Oracle Autonomous Database in Oracle Cloud Infrastructure](../../guide/i13e/oci/manage.md)

3. [Download and install SQLcl for Local Development](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/)

---

Verify that you can connect to local development database:

```bash
sql admin/************@127.0.0.1:1521/myatp
SELECT USER AS whoami FROM dual;
# WHOAMI 
# ______
# ADMIN
exit
```

## Create User (Schema)

### Step 1. Create a feature branch

```bash
git checkout main
git pull origin main
git checkout -b feat/db-initial-setup
```

### Step 2. Initialize project (if not done yet)

```bash
mkdir -p db
cd db
sql /nolog
project init -name odbvue-db
exit
```

### Step 3. Create `./db/src/app/000_create_schema_odbvue.sql`

::: details source
// todo
:::

### Step 4. Stage and commit  

```bash
cd db
sql /nolog
project stage db-initial-setup -file-name ./src/000_create_schema_odbvue.sql
!git add db/
!git commit -m "db: initial setup"
exit
```

### Step 5. Create changeset

```bash
cd apps
pnpm changeset
```

You'll be prompted to:

- Select which packages changed: db
- Choose the version bump type: patch
- Write a concise summary of the changes: db initial setup

```bash
git add apps/.changeset/
git commit -m "changeset: db initial setup"
```

### Step 6. Create and review Pull request

```bash
git push -u origin feat/db-initial-setup
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
git merge --squash feat/db-initial-setup
git push

# Clean up
git branch -d feat/db-initial-setup
git push origin --delete feat/db-initial-setup
```
