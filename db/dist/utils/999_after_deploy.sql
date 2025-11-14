ALTER DATABASE DEFAULT EDITION = "&EDITION";
/

DECLARE
    c CLOB := '&APP_CONFIG';

BEGIN
    -- Create admin user

    DECLARE 
        c_salt VARCHAR2(32 CHAR) := DBMS_RANDOM.STRING('X', 32);
        v_app_username VARCHAR2(2000 CHAR);
        v_app_password VARCHAR2(2000 CHAR);
        v_app_fullname VARCHAR2(2000 CHAR);
        v_app_host VARCHAR2(2000 CHAR);
    BEGIN

        DBMS_OUTPUT.PUT_LINE('Upserting admin user...');

        SELECT 
            JSON_VALUE(c, '$.app_username'),
            JSON_VALUE(c, '$.app_password'),
            JSON_VALUE(c, '$.app_fullname'),
            JSON_VALUE(c, '$.app_host')
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

        DBMS_OUTPUT.PUT_LINE('  ...completed');

    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  ...failed - ' || SQLERRM);
    END;

    -- Create admin role

    BEGIN
        DBMS_OUTPUT.PUT_LINE('Upserting admin role...');
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
        DBMS_OUTPUT.PUT_LINE('  ...completed');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  ...failed - ' || SQLERRM);
    END;

    -- Create admin permissions

    BEGIN
        DBMS_OUTPUT.PUT_LINE('Upserting admin permissions...');
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
        DBMS_OUTPUT.PUT_LINE('  ...completed'); 
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('  ...failed - ' || SQLERRM);
    END;

    -- Insert JWT settings
    BEGIN
        DBMS_OUTPUT.PUT_LINE('Upserting JWT settings...');

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

            EXECUTE IMMEDIATE 'MERGE INTO app_token_settings s
            USING (SELECT 1 AS rn FROM dual) t
            ON (1 = 1)
            WHEN MATCHED THEN
                UPDATE SET
                    issuer = :issuer,
                    audience = :audience,
                    secret = :secret
            WHEN NOT MATCHED THEN
                INSERT (issuer, audience, secret)
                VALUES (:issuer, :audience, :secret)'
            USING
                v_issuer,
                v_audience,
                v_secret,
                v_issuer,
                v_audience,
                v_secret;

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
            DBMS_OUTPUT.PUT_LINE('  ...completed');
        EXCEPTION
            WHEN OTHERS THEN
                DBMS_OUTPUT.PUT_LINE('  ...failed - ' || SQLERRM);
        END;
    END;

END;
/