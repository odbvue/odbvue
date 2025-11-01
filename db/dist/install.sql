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

@@dist/utils/000_before_deploy.sql

lb update -log -changelog-file releases/main.changelog.xml -search-path "."

@@dist/utils/999_after_deploy.sql

UNDEFINE adb_schema_name
UNDEFINE adb_schema_password
UNDEFINE version
UNDEFINE edition 
