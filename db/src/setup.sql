CREATE OR REPLACE PACKAGE odbvue AS
    
    PROCEDURE version;

    PROCEDURE create_schema(
        p_username IN VARCHAR2,
        p_password IN VARCHAR2
    );

END odbvue;
/

CREATE OR REPLACE PACKAGE BODY odbvue AS

    FUNCTION version RETURN VARCHAR2 
    AS
        v_db_version VARCHAR2(2000 CHAR);
    BEGIN
        SELECT version  INTO v_db_version FROM v$instance;
        RETURN v_db_version;
    END version;

    PROCEDURE version 
    AS
    BEGIN
        DBMS_OUTPUT.PUT_LINE('dbVersion: ' || version());
    END version;

    PROCEDURE create_schema(
        p_username IN VARCHAR2,
        p_password IN VARCHAR2
    ) AS
    BEGIN
        IF version() < '19' THEN 
            RAISE_APPLICATION_ERROR(-20001, 'Oracle DB version must be 19c or higher. Current version: ' || version()); 
            RETURN;
        END IF;

        IF p_username IS NULL OR p_password IS NULL THEN
            RAISE_APPLICATION_ERROR(-20002, 'Username and password must be provided.');
            RETURN;
        END IF;

        DBMS_OUTPUT.PUT_LINE('Creating user: ' || p_username);
    END create_schema;

END odbvue;
/

BEGIN
    odbvue.version;
    odbvue.create_schema(:username, :password);
END;
/