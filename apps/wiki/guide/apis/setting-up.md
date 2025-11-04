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

## SQLCl Project install

SQLcl Project allows, besides regular changes, to have *maintenance* scripts that run before and after each release deployment, by injecting in main install script.

####  `./db/dist/install.sql`

::: details source
```sql{17,21}
set define on
set verify off
set feedback off
set serveroutput on
set sqlblanklines on

VARIABLE adb_schema_name VARCHAR2(128 CHAR)
VARIABLE adb_schema_password VARCHAR2(128 CHAR)
VARIABLE version VARCHAR2(128 CHAR)
VARIABLE edition VARCHAR2(128 CHAR)

EXEC :adb_schema_name := '&ADB_SCHEMA_NAME';
EXEC :adb_schema_password := '&ADB_SCHEMA_PASSWORD';
EXEC :version := '&VERSION';
EXEC :edition := '&EDITION';

@@utils/000_before_deploy.sql

lb update -log -changelog-file releases/main.changelog.xml -search-path "."

@@utils/999_after_deploy.sql

UNDEFINE adb_schema_name
UNDEFINE adb_schema_password
UNDEFINE version
UNDEFINE edition 

```
:::

Ensure that schema is created on the first deployment and new edition for each deployment:

#### `./db/dist/utils/000_before_deploy.sql`

::: details source
```sql
DECLARE
  p_schema_name VARCHAR2(128) := :adb_schema_name;
  p_schema_password VARCHAR2(128) := :adb_schema_password;
  p_version VARCHAR2(128) := :version;
  p_edition VARCHAR2(128) := :edition;
  v_exists PLS_INTEGER;
BEGIN

    -- SCHEMA

    SELECT COUNT(*) 
    INTO v_exists 
    FROM dba_users 
    WHERE username = p_schema_name;
    
    DBMS_OUTPUT.PUT_LINE('- checking schema: ' || p_schema_name);
    IF v_exists = 0 THEN
        EXECUTE IMMEDIATE '
        CREATE USER ' || p_schema_name || ' 
        IDENTIFIED BY "' || REPLACE(p_schema_password,'"', '""') || '"
        DEFAULT TABLESPACE DATA
        TEMPORARY TABLESPACE TEMP
        QUOTA UNLIMITED ON DATA';
        DBMS_OUTPUT.PUT_LINE('  - schema created.');
    ELSE
        DBMS_OUTPUT.PUT_LINE('  - schema already exists.');
    END IF;

    FOR grants IN (
        SELECT 'CREATE SESSION' AS privilege FROM dual UNION ALL
        SELECT 'CREATE TABLE' FROM dual UNION ALL
        SELECT 'CREATE VIEW' FROM dual UNION ALL
        SELECT 'CREATE SEQUENCE' FROM dual UNION ALL
        SELECT 'CREATE PROCEDURE' FROM dual UNION ALL
        SELECT 'CREATE TRIGGER' FROM dual UNION ALL
        SELECT 'CREATE TYPE' FROM dual UNION ALL
        SELECT 'CREATE SYNONYM' FROM dual
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE '
                GRANT ' || grants.privilege || ' 
                TO ' || p_schema_name;
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -01918 THEN -- ignore "user/role does not exist"
                    NULL;
                ELSE
                    RAISE;    
                END IF;
        END;
    END LOOP;
    DBMS_OUTPUT.PUT_LINE('  - privileges granted.');

    -- EBR

    EXECUTE IMMEDIATE 'ALTER USER ' || p_schema_name || ' ENABLE EDITIONS';  
    BEGIN
        DBMS_OUTPUT.PUT_LINE('Create edition: ' || p_edition);
        EXECUTE IMMEDIATE '
            CREATE EDITION ' || p_edition || ' 
            ';
        EXECUTE IMMEDIATE 'GRANT USE ON EDITION ' || p_edition || ' TO ' || p_schema_name;
        DBMS_OUTPUT.PUT_LINE('  - Edition created.');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN
                DBMS_OUTPUT.PUT_LINE('  - Edition already exists.');
            ELSE
                DBMS_OUTPUT.PUT_LINE('  - Edition not created.');
                RAISE;
            END IF;
    END;

END;
/

ALTER SESSION SET EDITION = "&EDITION"
/

ALTER SESSION SET CURRENT_SCHEMA = "&ADB_SCHEMA_NAME";
/

```
:::

While after deployment script swaps the new edition as the default.

#### `./db/dist/utils/999_after_deploy.sql`

::: details source
```sql
ALTER DATABASE DEFAULT EDITION = "&EDITION";
/
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
