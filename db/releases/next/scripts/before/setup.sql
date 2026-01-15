DECLARE
    v_schema_username VARCHAR2(30 CHAR) := :DB_SCHEMA_USERNAME;
    v_schema_password VARCHAR2(200 CHAR) := :DB_SCHEMA_PASSWORD;
    v_exists NUMBER := 0;
BEGIN

    DBMS_OUTPUT.PUT_LINE('Database setup for schema: ' || v_schema_username);

    -- SCHEMA

    SELECT COUNT(*) 
    INTO v_exists 
    FROM dba_users 
    WHERE username = UPPER(v_schema_username);
    
    DBMS_OUTPUT.PUT_LINE('  creating schema');
    IF v_exists = 0 THEN
        EXECUTE IMMEDIATE '
        CREATE USER ' || v_schema_username || ' 
        IDENTIFIED BY "' || v_schema_password || '"
        DEFAULT TABLESPACE DATA
        TEMPORARY TABLESPACE TEMP
        QUOTA UNLIMITED ON DATA';
        DBMS_OUTPUT.PUT_LINE('    schema created');
    ELSE
        DBMS_OUTPUT.PUT_LINE('    schema already exists');
    END IF;

    -- GRANTS

    DBMS_OUTPUT.PUT_LINE('  granting privileges');
    FOR g IN (
            SELECT privilege FROM (
                SELECT 'CREATE SESSION' AS privilege FROM dual UNION ALL
                SELECT 'CREATE TABLE' AS privilege FROM dual UNION ALL
                SELECT 'CREATE VIEW' AS privilege FROM dual UNION ALL
                SELECT 'CREATE SEQUENCE' AS privilege FROM dual UNION ALL
                SELECT 'CREATE PROCEDURE' AS privilege FROM dual UNION ALL
                SELECT 'CREATE TRIGGER' AS privilege FROM dual UNION ALL
                SELECT 'CREATE TYPE' AS privilege FROM dual UNION ALL
                SELECT 'CREATE SYNONYM' AS privilege FROM dual UNION ALL
                SELECT 'MANAGE SCHEDULER' AS privilege FROM dual UNION ALL
                SELECT 'EXECUTE ON DBMS_SCHEDULER' AS privilege FROM dual UNION ALL
                SELECT 'EXECUTE ON DBMS_CRYPTO' AS privilege FROM dual UNION ALL
                SELECT 'EXECUTE ON DBMS_CLOUD' AS privilege FROM dual
            )
        )
    LOOP
        EXECUTE IMMEDIATE 'GRANT ' || g.privilege || ' TO ' || v_schema_username;
        DBMS_OUTPUT.PUT_LINE('    ' || g.privilege);
    END LOOP;

    -- EDITIONS

    DBMS_OUTPUT.PUT_LINE('  enabling editions');
    EXECUTE IMMEDIATE 'ALTER USER ' || v_schema_username || ' ENABLE EDITIONS';
    DBMS_OUTPUT.PUT_LINE('    editions enabled');

    -- RESOURCE PRINCIPAL

    DBMS_OUTPUT.PUT_LINE('  enabling resource principal');
    BEGIN
        DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL(v_schema_username);
        DBMS_OUTPUT.PUT_LINE('    resource principal enabled');
    EXCEPTION 
        WHEN OTHERS THEN 
            IF SQLCODE = -44002 THEN
                DBMS_OUTPUT.PUT_LINE('    resource principal already enabled');
            ELSE
                DBMS_OUTPUT.PUT_LINE('    resource principal not enabled');
            END IF;  
    END;

END;
/