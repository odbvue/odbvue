DECLARE
    c CLOB := :config;

    PROCEDURE setting(
        p_id IN VARCHAR2,
        p_name IN VARCHAR2,
        p_value IN VARCHAR2
    ) AS 
    BEGIN
        DBMS_OUTPUT.PUT_LINE('  - upserting setting: ' || p_id);
        EXECUTE IMMEDIATE 'MERGE INTO app_settings t 
        USING (SELECT :1 AS id, :2 AS name, :3 AS value FROM dual) s
        ON (t.id = s.id)
        WHEN MATCHED THEN
            UPDATE SET
                t.name = s.name,
                t.value = s.value
        WHEN NOT MATCHED THEN
            INSERT (id, name, value)
            VALUES (s.id, s.name, s.value)'
        USING
            p_id,
            p_name,
            p_value;

        COMMIT;
        DBMS_OUTPUT.PUT_LINE('    - completed.');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('    - failed: ' || SQLERRM);
    END;   

BEGIN

    -- ADMIN user

    DECLARE 
        c_salt VARCHAR2(32 CHAR) := DBMS_RANDOM.STRING('X', 32);
        v_app_username VARCHAR2(2000 CHAR);
        v_app_password VARCHAR2(2000 CHAR);
        v_app_fullname VARCHAR2(2000 CHAR);
        v_app_host VARCHAR2(2000 CHAR);

    BEGIN

        DBMS_OUTPUT.PUT_LINE('- upserting admin user.');

        SELECT 
            JSON_VALUE(c, '$.app.username'),
            JSON_VALUE(c, '$.app.password'),
            JSON_VALUE(c, '$.app.fullname'),
            JSON_VALUE(c, '$.app.host')
        INTO 
            v_app_username,
            v_app_password,
            v_app_fullname,
            v_app_host
        FROM dual;

        v_app_password := c_salt || DBMS_CRYPTO.HASH(UTL_RAW.CAST_TO_RAW(TRIM(v_app_password) || c_salt),4);

        EXECUTE IMMEDIATE '
            MERGE INTO app_users t
            USING (SELECT 1 AS id FROM dual) s
            ON (t.id = s.id)
            WHEN MATCHED THEN
                UPDATE SET
                    username = :username,
                    password = :password,
                    fullname = :fullname
            WHEN NOT MATCHED THEN
                INSERT (id, username, password, fullname)
                VALUES (1, :username, :password, :fullname)'
        USING
            UPPER(TRIM(v_app_username)),
            v_app_password,
            v_app_fullname,
            UPPER(TRIM(v_app_username)),
            v_app_password,
            v_app_fullname;

        COMMIT;

        DBMS_OUTPUT.PUT_LINE('  - completed.');

    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  - failed: ' || SQLERRM);
    END;

    -- Create admin role

    BEGIN
        DBMS_OUTPUT.PUT_LINE('- upserting admin role.');
        EXECUTE IMMEDIATE 'MERGE INTO app_roles r
        USING (SELECT 1 AS id FROM dual) s
        ON (r.id = s.id)
        WHEN MATCHED THEN
            UPDATE SET
                role = :role,
                description = :description
        WHEN NOT MATCHED THEN
            INSERT (id, role, description)
            VALUES (1, :role, :description)'
        USING 'ADMIN', 'Administrator access', 'ADMIN', 'Administrator access';
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('  - completed.');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  - failed: ' || SQLERRM);
    END;

    -- Create admin permissions

    BEGIN
        DBMS_OUTPUT.PUT_LINE('- upserting admin permissions.');
        EXECUTE IMMEDIATE 'MERGE INTO app_permissions p
        USING (
            SELECT 
                1 AS id_user,
                1 AS id_role
            FROM dual
        ) s ON (p.id_user = s.id_user AND p.id_role = s.id_role)
        WHEN MATCHED THEN 
            UPDATE SET p.permission = p.permission
        WHEN NOT MATCHED THEN 
            INSERT (id_user, id_role, permission) VALUES (s.id_user, s.id_role, ''Y'')';
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('  - completed.'); 
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  - failed: ' || SQLERRM);
    END;

    -- SMTP

    DECLARE
        v_smtp_host VARCHAR2(2000 CHAR);
        v_smtp_port NUMBER;
        v_smtp_username VARCHAR2(2000 CHAR);
        v_smtp_password VARCHAR2(2000 CHAR);
        v_smtp_addr VARCHAR2(2000 CHAR);
        v_smtp_name VARCHAR2(2000 CHAR);

        v_schema_name VARCHAR2(200 CHAR);
        v_smtp_credential VARCHAR2(200 CHAR);
    BEGIN

        DBMS_OUTPUT.PUT_LINE('- upserting SMTP settings.');   
    
        SELECT 
            JSON_VALUE(c, '$.smtp.host'),
            TO_NUMBER(JSON_VALUE(c, '$.smtp.port')),
            JSON_VALUE(c, '$.smtp.username'),
            JSON_VALUE(c, '$.smtp.password'),
            JSON_VALUE(c, '$.smtp.addr'),
            JSON_VALUE(c, '$.smtp.name')
        INTO
            v_smtp_host,
            v_smtp_port,
            v_smtp_username,
            v_smtp_password,
            v_smtp_addr,
            v_smtp_name
        FROM dual;

        v_schema_name := JSON_VALUE(c, '$.schema.username');
        v_smtp_credential := UPPER(v_schema_name || '_SMTP_CREDENTIAL');

        BEGIN

            DBMS_CLOUD.CREATE_CREDENTIAL(
                credential_name => v_smtp_credential,
                username        => v_smtp_username,
                password        => v_smtp_password
            );
            COMMIT;
            DBMS_OUTPUT.PUT_LINE('  - credential created.');
        EXCEPTION
             -- credential creation failed: ORA-20022: Credential "***"."ODBVUE_SMTP_CREDENTIAL" already exists
            WHEN OTHERS THEN
                IF SQLCODE = -20022 THEN
                    DBMS_OUTPUT.PUT_LINE('  - credential already exists, skipping creation.');
                ELSE
                    DBMS_OUTPUT.PUT_LINE('  - credential creation failed: ' || SQLERRM);
                END IF; 
        END;

        setting('APP_EMAILS_SMTP_CRED', 'App email SMTP credential', v_smtp_credential);
        setting('APP_EMAILS_SMTP_HOST', 'App email SMTP host', v_smtp_host);
        setting('APP_EMAILS_SMTP_PORT', 'App email SMTP port', TO_CHAR(v_smtp_port));
        setting('APP_EMAILS_FROM_ADDR', 'App email senders address', v_smtp_addr);
        setting('APP_EMAILS_FROM_NAME', 'App email senders name', v_smtp_name);
        setting('APP_EMAILS_REPLYTO_ADDR', 'App email reply to address', v_smtp_addr);
        setting('APP_EMAILS_REPLYTO_NAME', 'App email reply to name', v_smtp_name);

    END;

    -- S3

    BEGIN
        DBMS_OUTPUT.PUT_LINE('- upserting S3 settings.');

        DECLARE
            v_s3_endpoint VARCHAR2(2000 CHAR);
        BEGIN

            SELECT 
                JSON_VALUE(c, '$.s3')
            INTO 
                v_s3_endpoint
            FROM dual;

            setting('APP_STORAGE_S3_URI', 'S3 Endpoint', v_s3_endpoint);

            DBMS_OUTPUT.PUT_LINE('  - settings upsert completed.');
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('  - failed - ' || SQLERRM);
        END;
    END;

    -- JWT

    BEGIN
        DBMS_OUTPUT.PUT_LINE('- upserting JWT settings.');

        DECLARE
            v_issuer VARCHAR2(2000 CHAR);
            v_audience VARCHAR2(2000 CHAR);
            v_secret VARCHAR2(2000 CHAR);
        BEGIN

            SELECT 
                JSON_VALUE(c, '$.jwt.issuer'),
                JSON_VALUE(c, '$.jwt.audience'),
                JSON_VALUE(c, '$.jwt.secret')
            INTO 
                v_issuer,
                v_audience,
                v_secret
            FROM dual;

            setting('APP_AUTH_JWT_ISSUER', 'App authentication JWT Issuer', v_issuer);
            setting('APP_AUTH_JWT_AUDIENCE', 'App authentication JWT Audience', v_audience);
            setting('APP_AUTH_JWT_SECRET', 'App authentication JWT Secret', v_secret);

            DBMS_OUTPUT.PUT_LINE('  - settings upsert completed.');

            FOR rec IN (
                SELECT 
                    id,
                    name,
                    expiration,
                    stored
                FROM JSON_TABLE(
                    c,
                    '$.jwt.types[*]' COLUMNS (
                        id VARCHAR2(100) PATH '$.id',
                        name VARCHAR2(200) PATH '$.name',
                        expiration NUMBER PATH '$.expiration',
                        stored VARCHAR2(10) PATH '$.stored'
                    )
                ) 
            ) LOOP
                EXECUTE IMMEDIATE 'MERGE INTO app_token_types t
                USING (SELECT :id AS id FROM dual) s
                ON (t.id = s.id)
                WHEN MATCHED THEN
                    UPDATE SET
                        name = :name,
                        expiration = :expiration,
                        stored = :stored
                WHEN NOT MATCHED THEN
                    INSERT (id, name, expiration, stored)
                    VALUES (:id, :name, :expiration, :stored)'
                USING
                    rec.id,
                    rec.name,
                    rec.expiration,
                    rec.stored,
                    rec.id,
                    rec.name,
                    rec.expiration,
                    rec.stored;
            END LOOP;

            COMMIT;
            DBMS_OUTPUT.PUT_LINE('  - completed');
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('  - failed - ' || SQLERRM);
        END;
    END;

    BEGIN
        DBMS_OUTPUT.PUT_LINE('- creating rest services.');
        prc_ordsify;
        DBMS_OUTPUT.PUT_LINE('  - completed.');
    EXCEPTION 
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  - failed: ' || SQLERRM);
    END;   
END;
/

ALTER DATABASE DEFAULT EDITION = "&EDITION"
/
