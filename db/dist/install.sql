set define on
set verify off
set feedback off
set serveroutput on
set sqlblanklines on

VARIABLE version VARCHAR2(128 CHAR)
VARIABLE config CLOB
VARIABLE schema VARCHAR2(200 CHAR)
VARIABLE edition VARCHAR2(200 CHAR)

EXEC :version := '&VERSION';
EXEC :config := '&CONFIG';
EXEC :schema := '&SCHEMA';
EXEC :edition := '&EDITION';

PROMPT "-variables"
PROMPT "  - version: " || '&VERSION'
exec begin dbms_output.put_line('  - app config: ' || SUBSTR(:config, 1, 10) || '...'); end;
PROMPT "  - schema: " || '&SCHEMA'
PROMPT "  - edition: " || '&EDITION'
PROMPT ""

@@000_install.sql

PROMPT ""

lb update -log -changelog-file releases/main.changelog.xml -search-path "."

PROMPT ""

@@999_install.sql

PROMPT ""

UNDEFINE version
UNDEFINE config
UNDEFINE schema
UNDEFINE edition