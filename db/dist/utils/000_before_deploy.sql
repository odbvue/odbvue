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
        SELECT 'CREATE SYNONYM' FROM dual UNION ALL
        SELECT 'CREATE ANY JOB' FROM dual UNION ALL
        SELECT 'EXECUTE ON DBMS_CRYPTO' FROM dual
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
