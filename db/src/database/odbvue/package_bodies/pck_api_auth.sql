CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_auth AS 
    -- PRIVATE

    g_issuer      VARCHAR2(200);
    g_audience    VARCHAR2(200);
    g_secret      VARCHAR2(2000);
    TYPE t_token_type IS RECORD (
            id         VARCHAR2(30),
            name       VARCHAR2(200),
            stored     CHAR(1),
            expiration NUMBER(10)
    );
    TYPE t_token_types IS
        TABLE OF t_token_type INDEX BY VARCHAR2(30);
    g_token_types t_token_types;

    FUNCTION jwt_b64 (
        p_string VARCHAR2
    ) RETURN VARCHAR2 AS
    BEGIN
        RETURN translate((replace(
            utl_raw.cast_to_varchar2(utl_encode.base64_encode(utl_raw.cast_to_raw(p_string))),
            '='
        )),
                         unistr('+/=\000a\000d'),
                         '-_');
    END;

    FUNCTION jwt_enc (
        p_string VARCHAR2,
        p_secret VARCHAR2
    ) RETURN VARCHAR2 AS
    BEGIN
        RETURN jwt_b64(utl_raw.cast_to_varchar2(dbms_crypto.mac(
            utl_raw.cast_to_raw(p_string),
            dbms_crypto.hmac_sh256,
            utl_raw.cast_to_raw(p_secret)
        )));
    END;

    FUNCTION timestamp_to_unix (
        p_ts TIMESTAMP
    ) RETURN PLS_INTEGER AS
        v_epoch TIMESTAMP := TO_TIMESTAMP ( '1970-01-01', 'YYYY-MM-DD' );
    BEGIN
        RETURN floor((CAST(p_ts AS DATE) - CAST(v_epoch AS DATE)) * 86400);
    END;

    FUNCTION unix_to_timestamp (
        p_unix PLS_INTEGER
    ) RETURN TIMESTAMP AS
        v_epoch TIMESTAMP := TO_TIMESTAMP ( '1970-01-01', 'YYYY-MM-DD' );
    BEGIN
        RETURN v_epoch + numtodsinterval(p_unix, 'SECOND');
    END;

    FUNCTION jwt_sign (
        p_iss    VARCHAR2,
        p_sub    VARCHAR2,
        p_aud    VARCHAR2,
        p_stf    VARCHAR2,
        p_exp    TIMESTAMP,
        p_secret VARCHAR2
    ) RETURN VARCHAR2 AS
        v_header  VARCHAR2(2000 CHAR);
        v_payload VARCHAR2(2000 CHAR);
    BEGIN
        v_header := '{"alg":"HS256","typ":"JWT"}';
        v_payload :=
            JSON_OBJECT(
                'iss' VALUE p_iss,
                        'sub' VALUE p_sub,
                        'aud' VALUE p_aud,
                        'stf' VALUE p_stf,
                        'exp' VALUE timestamp_to_unix(p_exp),
                        'iat' VALUE timestamp_to_unix(systimestamp AT TIME ZONE 'UTC'),
                        'nbf' VALUE timestamp_to_unix(systimestamp AT TIME ZONE 'UTC'),
                        'jti' VALUE 0
            FORMAT JSON);

        RETURN jwt_b64(v_header)
               || '.'
               || jwt_b64(v_payload)
               || '.'
               || jwt_enc(jwt_b64(v_header)
                          || '.'
                          || jwt_b64(v_payload),
                          p_secret);

    END;

    PROCEDURE jwt_decode (
        p_token  VARCHAR2,
        p_secret VARCHAR2,
        r_iss    OUT VARCHAR2,
        r_sub    OUT VARCHAR2,
        r_aud    OUT VARCHAR2,
        r_stf    OUT VARCHAR2,
        r_exp    OUT PLS_INTEGER
    ) AS

        v_header          VARCHAR2(2000 CHAR) := substr(p_token,
                                               1,
                                               instr(p_token, '.') - 1);
        v_payload         VARCHAR2(2000 CHAR) := substr(p_token,
                                                instr(p_token, '.') + 1,
                                                (instr(p_token, '.', 1, 2)) -(instr(p_token, '.') + 1));
        v_signature       VARCHAR2(2000 CHAR) := substr(p_token,
                                                  (instr(p_token, '.', 1, 2) + 1));
        v_payload_decoded VARCHAR2(2000 CHAR);
    BEGIN
        IF jwt_enc((v_header
                    || '.' || v_payload), p_secret) = v_signature THEN
            v_payload_decoded := utl_raw.cast_to_varchar2(utl_encode.base64_decode(utl_raw.cast_to_raw(v_payload)));

            SELECT
                JSON_VALUE(v_payload_decoded, '$.iss')
            INTO r_iss
            FROM
                dual;

            SELECT
                JSON_VALUE(v_payload_decoded, '$.sub')
            INTO r_sub
            FROM
                dual;

            SELECT
                JSON_VALUE(v_payload_decoded, '$.aud')
            INTO r_aud
            FROM
                dual;

            SELECT
                JSON_VALUE(v_payload_decoded, '$.stf')
            INTO r_stf
            FROM
                dual;

            SELECT
                JSON_VALUE(v_payload_decoded, '$.exp')
            INTO r_exp
            FROM
                dual;

        END IF;
    END;

    -- PUBLIC

    FUNCTION pwd (
        p_password VARCHAR2
    ) RETURN VARCHAR2 AS
        c_salt VARCHAR2(32 CHAR) := dbms_random.string('X', 32);
    BEGIN
        RETURN c_salt
               || dbms_crypto.hash(
            utl_raw.cast_to_raw(trim(p_password) || c_salt),
            4
        );
    END;

    FUNCTION auth (
        p_username app_users.username%TYPE,
        p_password app_users.password%TYPE
    ) RETURN app_users.uuid%TYPE AS
        v_uuid app_users.uuid%TYPE;
    BEGIN
        BEGIN
            SELECT
                uuid
            INTO v_uuid
            FROM
                app_users
            WHERE
                    username = upper(trim(p_username))
                AND password = substr(password, 1, 32)
                               || dbms_crypto.hash(
                    utl_raw.cast_to_raw(trim(p_password) || substr(password, 1, 32)),
                    4
                );

        EXCEPTION
            WHEN no_data_found THEN
                NULL;
        END;

        RETURN v_uuid;
    END;

    PROCEDURE auth (
        p_username app_users.username%TYPE,
        p_password app_users.password%TYPE,
        r_uuid     OUT app_users.uuid%TYPE
    ) AS
    BEGIN
        r_uuid := auth(p_username, p_password);
    END;

    FUNCTION issue_token (
        p_uuid app_tokens.uuid%TYPE,
        p_type app_tokens.type_id%TYPE
    ) RETURN app_tokens.token%TYPE AS

        v_token app_tokens.token%TYPE;
        v_type  t_token_type := g_token_types(p_type);
        v_exp   TIMESTAMP;
        PRAGMA autonomous_transaction;
    BEGIN
        v_exp := systimestamp + v_type.expiration / 86400;
        v_token := jwt_sign(g_issuer, p_uuid, g_audience, v_type.stored, v_exp,
                            g_secret);

        IF v_type.stored = 'Y' THEN
            INSERT INTO app_tokens (
                uuid,
                type_id,
                token,
                expiration
            ) VALUES ( p_uuid,
                       p_type,
                       v_token,
                       v_exp );

            COMMIT;
        END IF;

        RETURN v_token;
    END;

    PROCEDURE issue_token (
        p_uuid  app_tokens.uuid%TYPE,
        p_type  app_tokens.type_id%TYPE,
        r_token OUT app_tokens.token%TYPE
    ) AS
    BEGIN
        r_token := issue_token(p_uuid, p_type);
    END;

    PROCEDURE revoke_token (
        p_token app_tokens.token%TYPE
    ) AS
        PRAGMA autonomous_transaction;
    BEGIN
        DELETE FROM app_tokens
        WHERE
            token = p_token;

        COMMIT;
    END;

    PROCEDURE revoke_token (
        p_uuid app_tokens.uuid%TYPE,
        p_type app_tokens.type_id%TYPE DEFAULT NULL
    ) AS
        PRAGMA autonomous_transaction;
    BEGIN
        DELETE FROM app_tokens
        WHERE
                uuid = p_uuid
            AND ( p_type IS NULL
                  OR type_id = p_type );

        COMMIT;
    END;

    PROCEDURE cleanup (
        p_batch_size PLS_INTEGER DEFAULT 10000
    ) AS
        v_total_deleted PLS_INTEGER := 0;
        v_batch_deleted PLS_INTEGER;
        PRAGMA autonomous_transaction;
    BEGIN
        LOOP
            DELETE FROM app_tokens
            WHERE
                    expiration < systimestamp
                AND ROWNUM <= p_batch_size;

            v_batch_deleted := SQL%rowcount;
            v_total_deleted := v_total_deleted + v_batch_deleted;
            COMMIT;
            EXIT WHEN v_batch_deleted = 0;
        END LOOP;

        dbms_output.put_line('Tokens cleaned up: ' || v_total_deleted);
    END;

    FUNCTION uuid_from_token (
        p_token            app_tokens.token%TYPE,
        p_check_expiration CHAR DEFAULT 'Y'
    ) RETURN app_users.uuid%TYPE AS

        v_iss  app_token_settings.issuer%TYPE;
        v_sub  app_users.uuid%TYPE;
        v_aud  app_token_settings.audience%TYPE;
        v_stf  app_tokens.token%TYPE;
        v_exp  PLS_INTEGER;
        v_uuid app_users.uuid%TYPE;
    BEGIN
        IF p_token IS NULL THEN
            RETURN NULL;
        END IF;
        jwt_decode(p_token, g_secret, v_iss, v_sub, v_aud,
                   v_stf, v_exp);
        IF ( v_iss <> g_issuer )
        OR ( v_aud <> g_audience ) THEN
            RETURN NULL;
        END IF;

        IF (
            ( p_check_expiration = 'Y' )
            AND ( v_exp < timestamp_to_unix(systimestamp AT TIME ZONE 'UTC') )
        ) THEN
            RETURN NULL;
        END IF;

        IF ( v_stf = 'Y' ) THEN
            BEGIN
                SELECT
                    t.uuid
                INTO v_uuid
                FROM
                    app_tokens t
                WHERE
                        t.token = p_token
                    AND ( p_check_expiration = 'N'
                          OR t.expiration > systimestamp );

            EXCEPTION
                WHEN no_data_found THEN
                    NULL;
            END;

            RETURN v_uuid;
        ELSE
            RETURN v_sub;
        END IF;

    END;

    FUNCTION uuid (
        p_check_expiration CHAR DEFAULT 'Y'
    ) RETURN app_users.uuid%TYPE AS
        v_token app_tokens.token%TYPE;
    BEGIN
        BEGIN
            v_token := replace(
                owa_util.get_cgi_env('Authorization'),
                'Bearer ',
                ''
            );
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;

        RETURN uuid_from_token(v_token, p_check_expiration);
    END;

    FUNCTION refresh (
        p_cookie_name      VARCHAR2 DEFAULT 'refresh_token',
        p_check_expiration CHAR DEFAULT 'Y'
    ) RETURN app_users.uuid%TYPE AS

        v_token app_tokens.token%TYPE;

        FUNCTION get_cookie_value (
            p_cookie_name IN VARCHAR2
        ) RETURN VARCHAR2 AS
            v_cookies      VARCHAR2(4000);
            v_start_pos    NUMBER;
            v_end_pos      NUMBER;
            v_cookie_value VARCHAR2(4000);
        BEGIN
            v_cookies := owa_util.get_cgi_env('HTTP_COOKIE');
            v_start_pos := instr(v_cookies, p_cookie_name || '=');
            IF v_start_pos > 0 THEN
                v_start_pos := v_start_pos + length(p_cookie_name) + 1;
                v_end_pos := instr(v_cookies, ';', v_start_pos);
                IF v_end_pos = 0 THEN
                    v_end_pos := length(v_cookies) + 1;
                END IF;
                v_cookie_value := substr(v_cookies, v_start_pos, v_end_pos - v_start_pos);
            ELSE
                v_cookie_value := NULL;
            END IF;

            RETURN v_cookie_value;
        END;

    BEGIN
        v_token := get_cookie_value(p_cookie_name);
        IF v_token IS NULL THEN
            RETURN uuid;
        ELSE
            RETURN uuid_from_token(v_token, p_check_expiration);
        END IF;

    END;

    FUNCTION role (
        p_uuid app_users.uuid%TYPE DEFAULT NULL,
        p_role app_roles.role%TYPE
    ) RETURN PLS_INTEGER AS
        v_uuid app_users.uuid%TYPE := p_uuid;
        v_role PLS_INTEGER;
    BEGIN
        IF v_uuid IS NULL THEN
            v_uuid := uuid();
        END IF;
        IF v_uuid IS NULL THEN
            RETURN v_role;
        END IF;
        SELECT
            COUNT(permission)
        INTO v_role
        FROM
            app_permissions
        WHERE
                id_user = (
                    SELECT
                        id
                    FROM
                        app_users
                    WHERE
                        uuid = v_uuid
                )
            AND id_role = (
                SELECT
                    id
                FROM
                    app_roles
                WHERE
                    role = upper(p_role)
            )
            AND ( valid_from IS NULL
                  OR valid_from <= systimestamp )
            AND ( valid_to IS NULL
                  OR valid_to > systimestamp );

        RETURN v_role;
    END;

    FUNCTION perm (
        p_uuid       app_users.uuid%TYPE DEFAULT NULL,
        p_role       app_roles.role%TYPE,
        p_permission app_permissions.permission%TYPE
    ) RETURN PLS_INTEGER AS
        v_uuid app_users.uuid%TYPE := p_uuid;
        v_perm PLS_INTEGER := 0;
    BEGIN
        IF v_uuid IS NULL THEN
            v_uuid := uuid();
        END IF;
        IF v_uuid IS NULL THEN
            RETURN v_perm;
        END IF;
        SELECT
            COUNT(permission)
        INTO v_perm
        FROM
            app_permissions
        WHERE
                id_user = (
                    SELECT
                        id
                    FROM
                        app_users
                    WHERE
                        uuid = v_uuid
                )
            AND id_role = (
                SELECT
                    id
                FROM
                    app_roles
                WHERE
                    role = upper(p_role)
            )
            AND permission = p_permission
            AND ( valid_from IS NULL
                  OR valid_from <= systimestamp )
            AND ( valid_to IS NULL
                  OR valid_to > systimestamp );

        RETURN v_perm;
    END;

    PROCEDURE http_401 (
        p_error VARCHAR2 DEFAULT NULL
    ) AS
    BEGIN
        owa_util.status_line(
            nstatus       => 401,
            creason       => 'Unauthorized',
            bclose_header => FALSE
        );

        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.p('{"error": "'
              || coalesce(p_error, 'Unauthorized') || '"}');
    END;

    PROCEDURE http_403 (
        p_error VARCHAR2 DEFAULT NULL
    ) AS
    BEGIN
        owa_util.status_line(
            nstatus       => 403,
            creason       => 'Forbidden',
            bclose_header => FALSE
        );

        owa_util.mime_header('application/json', FALSE);
        owa_util.http_header_close;
        htp.p('{"error": "'
              || coalesce(p_error, 'Forbidden') || '"}');
    END;

    PROCEDURE reload_settings AS
    BEGIN
        SELECT
            issuer,
            audience,
            secret
        INTO
            g_issuer,
            g_audience,
            g_secret
        FROM
            app_token_settings;

        g_token_types.DELETE;
        FOR rec IN (
            SELECT
                id,
                name,
                stored,
                expiration
            FROM
                app_token_types
        ) LOOP
            g_token_types(rec.id) := rec;
        END LOOP;

    END;

BEGIN
    reload_settings;
END;
/


-- sqlcl_snapshot {"hash":"3716c1a9b2e35a2704ed42d286d7015d7164bfae","type":"PACKAGE_BODY","name":"PCK_API_AUTH","schemaName":"ODBVUE","sxml":""}