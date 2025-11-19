# Setting up

## Prepare Environment

1. [Enable Oracle Autonomous Database for Local Development](../../guide/i13e/local-development/database.md#connect-to-database)

2. [Enable Oracle Autonomous Database in Oracle Cloud Infrastructure](../../guide/i13e/oci/access.md#autonomous-database)

3. [Download and install SQLcl for Local Development](https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/download/)


> [!TIP]
> MCP server for enabling agents to talk in native language with database can be enabled by adding to VSCode settings:
>
>```json
>    "modelContextProtocol": {
>        "servers": {
>            "sqlcl": {
>            "command": "sqlcl",
>            "args": ["--mcp"]
>            }
>       }
>    },
>```

## SQLCl Project Deployments

SQLcl Project Deploy executes *install* scripts that run before and after changeset deployment. 

####  `./db/dist/install.sql`

::: details source
<<< ../../../../db/dist/install.sql
:::

####  `./db/dist/000_install.sql`

::: details source
<<< ../../../../db/dist/000_install.sql
:::

####  `./db/dist/999_install.sql`

::: details source
<<< ../../../../db/dist/999_install.sql
:::

These scripts apply application configuration from Environment variables:

- **VERSION** - release version. e.g. `v0.0.161`
- **SCHEMA** - schema name. e.g. `odbvue`
- **EDITION** - concatenation of schema and edition - `ODBVUE_V_0_0_161`
- **CONFIG** - application configuration in JSON format (single lined). See example below.

####  `./db/config.json.example`

::: details source
```json
{
  "schema": {
    "username": "odbvue",
    "password": "************",
    "grants": [
      "CREATE SESSION",
      "CREATE TABLE",
      "CREATE VIEW",
      "CREATE SEQUENCE",
      "CREATE PROCEDURE",
      "CREATE TRIGGER",
      "CREATE TYPE",
      "CREATE SYNONYM",
      "MANAGE SCHEDULER",
      "EXECUTE ON DBMS_SCHEDULER",
      "EXECUTE ON DBMS_CRYPTO",
      "EXECUTE ON DBMS_CLOUD"
    ],
    "enable_resource_principal": true
  },
  "acl":[
    {"host":"api.chucknorris.io","lower_port":443,"upper_port":443,"privilege":"http"},
    {"host":"api.openai.com","lower_port":443,"upper_port":443,"privilege":"http"},
    {"host":"smtp.email.eu-stockholm-1.oci.oraclecloud.com","lower_port":587,"upper_port":587,"privilege":"smtp"}
  ],
  "app":{
    "username": "admin@odbvue.com",
    "password": "************",
    "fullname": "OdbVue Admin",
    "host": "apps.odbvue.com"
  },
  "smtp": {
    "host": "smtp.email.eu-stockholm-1.oci.oraclecloud.com",
    "port": 587,
    "username": "ocid1.user.oc1..aaaa..fnhq.xy.com",
    "password": "************",
    "addr": "admin@odbvue.com",
    "name": "OdbVue Admin"
  },
  "s3": "https://objectstorage.<region>.oraclecloud.com/n/<namespace>/b/<bucket>/o/",
  "jwt": {
    "issuer": "OdbVue",
    "audience": "OdbVue Users",
    "secret": "************",
    "types": [
      {
        "id": "ACCESS",
        "name": "Access Token",
        "expiration": 900,
        "stored": "N"
      },
      {
        "id": "REFRESH",
        "name": "Refresh Token",
        "expiration": 604800,
        "stored": "Y"
      },
      {
        "id": "VERIFY",
        "name": "Identity Verification Token",
        "expiration": 86400,
        "stored": "Y"
      }
    ]
  }
}

```
:::

## Edition Based Redefinition

**Oracle Edition-Based Redefinition (EBR)** is a feature that allows **online application upgrades** with **zero downtime**.

It works by using **“editions”**, which are private copies of database objects (like PL/SQL packages, views, synonyms, etc.). You can create a new edition, make changes there, and run the old and new application versions **side by side** until the upgrade is complete.

Above scripts provide automatic creation of new edition per each release.

> [!NOTE]
> Feature specifics is that each new edition is chained to previous and by time the chain can get quite long. That has a tiny impact as edition itself is just metadata but from clarity perspective it is advisable to do cleanup (drop editions down to `ORA$BASE`) when there is a maintenance window.
>
> Information about editions and editioned objects:
>
> ```sql
> SELECT * FROM all_editions;
> SELECT * FROM all_objects_ae WHERE edition_name IS NOT NULL;
> ```  

## Enabling ORDS

### Concept

**OdbVue** Database has an automation feature that auto enables REST services for PL/SQL package procedures that matches certain pattern.

If package includes procedures with `get_`, `post_`, `put_`, `delete_` prefix, they are immediately after deployment publicly exposed in ORDS.

Pattern in as follows:

- Packages becomes modules (prefix `pck_` is removed if exists; `_` are replaced to `-`)

- Procedures become methods (prefixes `get_`, `post_`, `put_`, `delete_` are removed; `_` are replaced to `-`)

- Non-defaulted attributes become path parameters

- Defaulted attributes become query parameters

- Everything get lower-cased

### Example

This:

```plsql
CREATE OR REPLACE EDITIONABLE PACKAGE pck_app AS -- Package for the main application 
    
    PROCEDURE get_context ( -- Returns application context
        r_version OUT VARCHAR2 -- Application version
    );

END pck_app;
/

CREATE OR REPLACE EDITIONABLE PACKAGE BODY pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    PROCEDURE get_context (
        r_version OUT VARCHAR2
    ) IS
    BEGIN
        r_version := g_version;

    END get_context;

BEGIN
    SELECT REPLACE(LOWER(REGEXP_REPLACE(SYS_CONTEXT('USERENV', 'CURRENT_EDITION_NAME'), '^[A-Z0-9#$_]+_V_', 'v')), '_', '.')
    INTO g_version
    FROM dual;
END pck_app;
/
```

becomes this:

```log
Creating module: app
  Creating endpoint: GET context/
```

and is publicly accessible.

Requesting:

```bash
curl -X GET "https://localhost:8443/ords/odbvue/context/" -k
```

returns:

```json
{"version":"v0.0.61"}
```

> [!TIP]
> Pattern is as follows:
> - for GET `https://localhost:8443/ords/[schema-name]/[package-name]/[procedure-name]/[non-defualted-attributes]?[defaulted-attributes]`
> - same for POST/PUT/DELETE, just `[defaulted-attributes]` shall be passed in request body 

> [!TIP]
> ORDS automatically generates Open API manifest:
> - local: `https://localhost:8443/ords/<schema>/open-api-catalog/`
> - oci: `https://<domain>.adb.<region>.oraclecloudapps.com/ords/<schema>/open-api-catalog/`

### Implementation underneath

Standalone procedure is initiated by Trigger each time when schema objects changes.

#### `./db/src/database/odbvue/triggers/trg_ordsify.sql`

::: details source
<<< ../../../../db/src/database/odbvue/triggers/trg_ordsify.sql
:::

#### `./db/src/database/odbvue/procedures/prc_ordsify.sql`

::: details source
<<< ../../../../db/src/database/odbvue/procedures/prc_ordsify.sql
:::
