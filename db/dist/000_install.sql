DECLARE
    c CLOB := :config;

    v_schema_username VARCHAR2(200 CHAR) := :schema;
    v_schema_password VARCHAR2(200 CHAR);

    v_edition VARCHAR2(200 CHAR) := :edition;

    v_exists PLS_INTEGER;
BEGIN

    -- PARAMETERS

    v_schema_password := JSON_VALUE(c, '$.schema.password');

    IF v_schema_username IS NULL THEN
        RAISE_APPLICATION_ERROR(-20001, 'Schema username not defined in config.');
    END IF;

    -- SCHEMA

    SELECT COUNT(*) 
    INTO v_exists 
    FROM dba_users 
    WHERE username = UPPER(v_schema_username);
    
    DBMS_OUTPUT.PUT_LINE('- creating schema: ' || v_schema_username);
    IF v_exists = 0 THEN
        EXECUTE IMMEDIATE '
        CREATE USER ' || v_schema_username || ' 
        IDENTIFIED BY "' || v_schema_password || '"
        DEFAULT TABLESPACE DATA
        TEMPORARY TABLESPACE TEMP
        QUOTA UNLIMITED ON DATA';
        DBMS_OUTPUT.PUT_LINE('  - schema created.');
    ELSE
        BEGIN
            EXECUTE IMMEDIATE 'ALTER USER ' || v_schema_username || ' IDENTIFIED BY "' || v_schema_password || '"';
            DBMS_OUTPUT.PUT_LINE('  - schema already exists.');
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -28007 THEN
                    DBMS_OUTPUT.PUT_LINE('  - password cannot be reused. Skipping password update.');
                ELSE
                    RAISE;
                END IF;
        END;
    END IF;

    -- GRANTS

    DBMS_OUTPUT.PUT_LINE('- granting privileges.');
    FOR grants IN (
        SELECT privilege 
        FROM JSON_TABLE(
            c,
            '$.schema.grants[*]' 
            COLUMNS (
                privilege VARCHAR2(200 CHAR) PATH '$'
            )
        )
    ) LOOP
        BEGIN
            EXECUTE IMMEDIATE '
                GRANT ' || grants.privilege || ' 
                TO ' || v_schema_username;
            DBMS_OUTPUT.PUT_LINE('  - privilege granted: ' || grants.privilege);
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE != -01918 THEN -- ignore "user/role does not exist"
                    NULL;
                ELSE
                    RAISE;    
                END IF;
        END;
    END LOOP;

    -- EDITION

    EXECUTE IMMEDIATE 'ALTER USER ' || v_schema_username || ' ENABLE EDITIONS';  
    BEGIN
        DBMS_OUTPUT.PUT_LINE('- creating edition: ' || v_edition);
        EXECUTE IMMEDIATE '
            CREATE EDITION ' || v_edition || ' 
            ';
        EXECUTE IMMEDIATE 'GRANT USE ON EDITION ' || v_edition || ' TO ' || v_schema_username;
        DBMS_OUTPUT.PUT_LINE('  - edition created.');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN
                DBMS_OUTPUT.PUT_LINE('  - edition already exists.');
            ELSE
                DBMS_OUTPUT.PUT_LINE('  - edition not created.');
                RAISE;
            END IF;
    END;

    -- RESOURCE PRINCIPAL

    IF JSON_VALUE(c, '$.enable_resource_principal') = 'true' THEN
        DBMS_OUTPUT.PUT_LINE('- enabling resource principal.');
        BEGIN
            DBMS_CLOUD_ADMIN.ENABLE_RESOURCE_PRINCIPAL(v_schema_username);
            DBMS_OUTPUT.PUT_LINE('  - resource principal enabled.');
        EXCEPTION 
            WHEN OTHERS THEN 
                IF SQLCODE = -44002 THEN
                    DBMS_OUTPUT.PUT_LINE('  - resource principal already enabled.');
                ELSE
                    DBMS_OUTPUT.PUT_LINE('  - resource principal not enabled.');
                END IF;  
        END;
    END IF;

    -- ACL

    DBMS_OUTPUT.PUT_LINE('- configuring ACL.');
    FOR ace IN (
        SELECT 
            jt.host AS host,
            jt.lower_port AS lower_port,
            jt.upper_port AS upper_port,
            jt.privilege AS privilege
        FROM JSON_TABLE(
            c,
            '$.acl[*]' 
            COLUMNS (
                host VARCHAR2(200 CHAR) PATH '$.host',
                lower_port NUMBER PATH '$.lower_port',
                upper_port NUMBER PATH '$.upper_port',
                privilege VARCHAR2(100 CHAR) PATH '$.privilege'
            )
        ) jt
    ) LOOP

        BEGIN

            DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACE (
                host => ace.host,
                lower_port => ace.lower_port,
                upper_port => ace.upper_port,
                ace => xs$ace_type(
                    privilege_list => xs$name_list(ace.privilege),
                    principal_name => UPPER(v_schema_username),
                    principal_type => xs_acl.ptype_db
                )
            );
            DBMS_OUTPUT.PUT_LINE('  - ACL entry added for host: ' || ace.host || ', privilege: ' || ace.privilege);

            COMMIT;
        EXCEPTION
            WHEN OTHERS THEN
                IF SQLCODE = -45137 THEN
                    DBMS_OUTPUT.PUT_LINE('  - ACL entry already exists for host: ' || ace.host || ', privilege: ' || ace.privilege);
                ELSE
                    DBMS_OUTPUT.PUT_LINE('  - error adding ACL entry for host: ' || ace.host || ', privilege: ' || ace.privilege || '. Error: ' || SQLERRM);
                END IF;
        END;

    END LOOP;

END;
/

DECLARE
    v_schema VARCHAR2(200 CHAR) := :schema;
BEGIN
    EXECUTE IMMEDIATE 'ALTER SESSION SET CURRENT_SCHEMA = ' || v_schema;
END;
/

ALTER SESSION SET EDITION = "&EDITION"
/