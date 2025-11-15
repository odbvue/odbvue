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

BEGIN
  DBMS_OUTPUT.PUT_LINE('- variables');
  DBMS_OUTPUT.PUT_LINE('  - version: ' || :version);
  DBMS_OUTPUT.PUT_LINE('  - app config: ' || SUBSTR(:config, 1, 10) || '...');
  DBMS_OUTPUT.PUT_LINE('  - schema: ' || :schema);
  DBMS_OUTPUT.PUT_LINE('  - edition: ' || :edition);
END;
/

@@utils/000_before_deploy.sql

ALTER SESSION SET CURRENT_SCHEMA = "&SCHEMA"
/

ALTER SESSION SET EDITION = "&EDITION"
/

lb update -log -changelog-file releases/main.changelog.xml -search-path "."

@@utils/999_after_deploy.sql

ALTER DATABASE DEFAULT EDITION = "&EDITION"
/

UNDEFINE version
UNDEFINE config
UNDEFINE schema
UNDEFINE edition