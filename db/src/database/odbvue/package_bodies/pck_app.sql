CREATE OR REPLACE PACKAGE BODY odbvue.pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    -- PRIVATE

    PROCEDURE send_email (
        p_template   app_settings.id%TYPE,
        p_username   app_users.username%TYPE,
        p_fullname   app_users.fullname%TYPE,
        p_subject    app_emails.subject%TYPE,
        p_attributes CLOB
    ) AS
        v_id       app_emails.id%TYPE;
        v_template CLOB;
    BEGIN
        v_template := pck_api_settings.read(p_template);
        FOR a IN (
            SELECT
                key,
                value
            FROM
                JSON_TABLE ( p_attributes, '$[*]'
                    COLUMNS (
                        key VARCHAR2 ( 200 CHAR ) PATH '$.key',
                        value VARCHAR2 ( 2000 CHAR ) PATH '$.value'
                    )
                )
        ) LOOP
            v_template := replace(v_template, '{{'
                                              || a.key
                                              || '}}', a.value);
        END LOOP;

        pck_api_emails.mail(v_id,
                            trim(p_username),
                            p_fullname,
                            p_subject,
                            v_template);
        pck_api_emails.send(v_id);
    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Send email',
                                pck_api_audit.attributes('username', p_username, 'fullname', p_fullname, 'subject',
                                                         p_subject, 'template', p_template, 'attributes', p_attributes,
                                                         'error', sqlerrm));
    END;

    -- PUBLIC

    PROCEDURE get_context (
        r_version  OUT VARCHAR2,
        r_user     OUT SYS_REFCURSOR,
        r_consents OUT SYS_REFCURSOR,
        r_config   OUT SYS_REFCURSOR
    ) IS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid;
    BEGIN
        r_version := g_version;
        OPEN r_consents FOR SELECT
                                                    id          AS "id",
                                                    language_id AS "language",
                                                    name        AS "name",
                                                    created     AS "created"
                                                FROM
                                                    app_consents
                            WHERE
                                active = 'Y'
                            ORDER BY
                                created DESC;

        OPEN r_config FOR SELECT
                                              id    AS "key",
                                              value AS "value"
                                          FROM
                                              app_settings
                         WHERE
                             id IN ( 'APP_PERFORMANCE_THERESHOLD_MS' );

        IF v_uuid IS NULL THEN
            RETURN;
        END IF;
        OPEN r_user FOR SELECT
                                            uuid                                    AS "uuid",
                                            username                                AS "username",
                                            fullname                                AS "fullname",
                                            to_char(created, 'YYYY-MM-DD HH24:MI')  AS "created",
                                            to_char(accessed, 'YYYY-MM-DD HH24:MI') AS "accessed",
                                            coalesce((
                                                SELECT
                                                    JSON_ARRAYAGG(
                                                        JSON_OBJECT(
                                                            'role' VALUE r.role,
                                                            'permission' VALUE p.permission,
                                                            'validfrom' VALUE p.valid_from,
                                                            'validto' VALUE p.valid_to
                                                        )
                                                    )
                                                FROM
                                                         app_permissions p
                                                    JOIN app_roles r ON r.id = p.id_role
                                                    JOIN app_users u ON u.id = p.id_user
                                                WHERE
                                                    u.uuid = v_uuid
                                            ),
                                                     '[]')                          AS "{}privileges"
                                        FROM
                                            app_users
                        WHERE
                                uuid = v_uuid
                            AND v_uuid IS NOT NULL;

    END get_context;

    PROCEDURE post_login (
        p_username      app_users.username%TYPE,
        p_password      app_users.password%TYPE,
        r_access_token  OUT app_tokens.token%TYPE,
        r_refresh_token OUT app_tokens.token%TYPE
    ) AS
        v_uuid        app_users.uuid%TYPE;
        v_status      PLS_INTEGER;
        v_audit_attrs app_audit.attributes%TYPE;
    BEGIN
        pck_api_auth.auth(p_username, p_password, v_uuid, v_status);
        v_audit_attrs := pck_api_audit.attributes('username', p_username, 'password', '********', 'uuid',
                                                  v_uuid, 'status', v_status);

        IF ( v_status = 200 ) THEN
            r_access_token := pck_api_auth.issue_token(v_uuid, 'ACCESS');
            pck_api_auth.revoke_token(v_uuid, 'REFRESH');
            r_refresh_token := pck_api_auth.issue_token(v_uuid, 'REFRESH');
            pck_api_audit.info('Login success', v_audit_attrs);
        ELSE
            pck_api_audit.warn('Login error', v_audit_attrs);
        END IF;

        pck_api_auth.http(v_status);
    EXCEPTION
        WHEN OTHERS THEN
            r_access_token := NULL;
            r_refresh_token := NULL;
            pck_api_audit.error('Login error', v_audit_attrs);
            pck_api_auth.http(401);
    END;

    PROCEDURE post_logout AS

        v_uuid        app_users.uuid%TYPE := coalesce(pck_api_auth.uuid,
                                               pck_api_auth.refresh('refresh_token'));
        v_audit_attrs app_audit.attributes%TYPE := pck_api_audit.attributes('uuid', v_uuid);
    BEGIN
        pck_api_auth.revoke_token(v_uuid, 'ACCESS');
        pck_api_auth.revoke_token(v_uuid, 'REFRESH');
        IF v_uuid IS NOT NULL THEN
            pck_api_audit.info('Logout success', v_audit_attrs);
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Logout error', v_audit_attrs);
    END;

    PROCEDURE post_refresh (
        r_access_token  OUT app_tokens.token%TYPE,
        r_refresh_token OUT app_tokens.token%TYPE
    ) AS

        v_uuid        app_users.uuid%TYPE := pck_api_auth.refresh('refresh_token');
        v_audit_attrs app_audit.attributes%TYPE := pck_api_audit.attributes('uuid', v_uuid);
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
        ELSE
            r_access_token := pck_api_auth.issue_token(v_uuid, 'ACCESS');
            r_refresh_token := pck_api_auth.issue_token(v_uuid, 'REFRESH');
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            r_access_token := NULL;
            r_refresh_token := NULL;
            pck_api_audit.error('Refresh error', v_audit_attrs);
            pck_api_auth.http_401;
    END;

    PROCEDURE get_consent (
        p_id      app_consents.id%TYPE,
        r_consent OUT CLOB
    ) AS
    BEGIN
        SELECT
            content
        INTO r_consent
        FROM
            app_consents
        WHERE
            id = p_id;

    END get_consent;

    PROCEDURE post_signup (
        p_username      app_users.username%TYPE,
        p_password      app_users.password%TYPE,
        p_fullname      app_users.fullname%TYPE,
        p_consent       app_consents.id%TYPE,
        r_access_token  OUT app_tokens.token%TYPE,
        r_refresh_token OUT app_tokens.token%TYPE,
        r_errors        OUT SYS_REFCURSOR,
        r_error         OUT VARCHAR2
    ) AS

        v_consent_id     app_consents.id%TYPE;
        v_uuid           app_users.uuid%TYPE;
        v_email_template CLOB;
        v_verify_token   app_tokens.token%TYPE;
        v_email_id       app_emails.id%TYPE;

        FUNCTION audit_attrs RETURN app_audit.attributes%TYPE IS
        BEGIN
            RETURN pck_api_audit.attributes('username', p_username, 'password', '********', 'fullname',
                                            p_fullname, 'consent', p_consent, 'error', r_error,
                                            'uuid', v_uuid);
        END audit_attrs;

    BEGIN
        pck_api_validate.validate('username',
                                  p_username,
                                  pck_api_validate.rule('email', NULL, 'username.must.be.valid.email.address'),
                                  r_error,
                                  r_errors);

        IF r_error IS NOT NULL THEN
            pck_api_audit.warn('Signup', audit_attrs);
            r_error := NULL;
            RETURN;
        END IF;

        pck_api_validate.validate('password',
                                  p_password,
                                  pck_api_validate.rule('regexp',
                                                        pck_api_settings.read('APP_AUTH_PASSWORD_REQUIREMENTS'),
                                                        pck_api_settings.read('APP_AUTH_PASSWORD_MESSAGE')),
                                  r_error,
                                  r_errors);

        IF r_error IS NOT NULL THEN
            pck_api_audit.warn('Signup', audit_attrs);
            r_error := NULL;
            RETURN;
        END IF;

        pck_api_validate.validate('fullname',
                                  p_fullname,
                                  pck_api_validate.rule('required', NULL, 'full.name.is.required'),
                                  r_error,
                                  r_errors);

        IF r_error IS NOT NULL THEN
            pck_api_audit.warn('Signup', audit_attrs);
            r_error := NULL;
            RETURN;
        END IF;

        BEGIN
            SELECT
                id
            INTO v_consent_id
            FROM
                app_consents
            WHERE
                p_consent IS NOT NULL
                AND id = p_consent;

        EXCEPTION
            WHEN no_data_found THEN
                r_error := 'consent.is.invalid';
                pck_api_audit.warn('Signup', audit_attrs);
                RETURN;
        END;

        BEGIN
            INSERT INTO app_users (
                username,
                password,
                fullname
            ) VALUES ( upper(trim(p_username)),
                       pck_api_auth.pwd(p_password),
                       TRIM(p_fullname) ) RETURNING uuid INTO v_uuid;

            INSERT INTO app_user_consents (
                user_id,
                consent_id
            ) VALUES ( v_uuid,
                       v_consent_id );

            COMMIT;
        EXCEPTION
            WHEN dup_val_on_index THEN
                r_error := 'username.already.exists';
                pck_api_audit.warn('Signup', audit_attrs);
                OPEN r_errors FOR SELECT
                                      'username' AS "name",
                                      r_error    AS "message"
                                  FROM
                                      dual;

                r_error := NULL;
                RETURN;
        END;

        r_access_token := pck_api_auth.issue_token(v_uuid, 'ACCESS');
        r_refresh_token := pck_api_auth.issue_token(v_uuid, 'REFRESH');
        pck_api_auth.revoke_token(v_uuid, 'VERIFY');
        v_verify_token := pck_api_auth.issue_token(v_uuid, 'VERIFY');
        send_email(
            p_template   => 'APP_EMAIL_VERIFY_TEMPLATE',
            p_username   => p_username,
            p_fullname   => p_fullname,
            p_subject    => 'Message from OdbVue',
            p_attributes => JSON_ARRAY(
                JSON_OBJECT(
                    'key' VALUE 'APP_EMAIL_VERIFY_TOKEN',
                    'value' VALUE v_verify_token
                ),
           JSON_OBJECT(
                    'key' VALUE 'APP_DOMAIN_NAME',
                       'value' VALUE pck_api_settings.read('APP_DOMAIN_NAME')
                )
            )
        );

        pck_api_audit.info('Signup', audit_attrs);
    EXCEPTION
        WHEN OTHERS THEN
            r_access_token := NULL;
            r_refresh_token := NULL;
            r_error := 'something.went.wrong';
            pck_api_audit.error('Signup error', audit_attrs);
    END post_signup;

    PROCEDURE post_confirm_email (
        p_token app_tokens.token%TYPE,
        r_error OUT VARCHAR2
    ) AS
        v_uuid app_users.uuid%TYPE;
    BEGIN
        BEGIN
            SELECT
                uuid
            INTO v_uuid
            FROM
                app_tokens
            WHERE
                    token = p_token
                AND type_id = 'VERIFY'
                AND expiration > systimestamp;

        EXCEPTION
            WHEN no_data_found THEN
                r_error := 'Invalid token';
                pck_api_auth.revoke_token(p_token => p_token);
                pck_api_audit.warn('Confirm email',
                                   pck_api_audit.attributes('uuid', v_uuid));
                RETURN;
        END;

        UPDATE app_users
        SET
            status = 'A'
        WHERE
            uuid = v_uuid;

        COMMIT;
        pck_api_auth.revoke_token(p_token => p_token);
        pck_api_audit.info('Confirm email',
                           pck_api_audit.attributes('uuid', v_uuid));
    EXCEPTION
        WHEN OTHERS THEN
            r_error := 'something.went.wrong';
            pck_api_auth.revoke_token(p_token => p_token);
            pck_api_audit.error('Confirm email',
                                pck_api_audit.attributes('uuid', v_uuid));
    END;

    PROCEDURE post_recover_password (
        p_username app_users.username%TYPE,
        r_error    OUT VARCHAR2
    ) AS

        v_uuid     app_users.uuid%TYPE;
        v_fullname app_users.fullname%TYPE;
        v_token    app_tokens.token%TYPE;
    BEGIN
        UPDATE app_users
        SET
            status = 'N'
        WHERE
            username = TRIM(upper(p_username))
        RETURNING uuid,
                  fullname INTO v_uuid, v_fullname;

        IF SQL%rowcount = 0 THEN
            r_error := 'wrong.username';
            pck_api_audit.warn('Recover password',
                               pck_api_audit.attributes('username', p_username, 'error', r_error));

            RETURN;
        END IF;

        pck_api_auth.revoke_token(v_uuid, 'VERIFY');
        v_token := pck_api_auth.issue_token(v_uuid, 'VERIFY');
        send_email(
            p_template   => 'APP_EMAIL_RECOVER_TEMPLATE',
            p_username   => p_username,
            p_fullname   => v_fullname,
            p_subject    => 'Recover your password',
            p_attributes => JSON_ARRAY(
                JSON_OBJECT(
                    'key' VALUE 'APP_PASSWORD_RESET_TOKEN',
                    'value' VALUE v_token
                ),
           JSON_OBJECT(
                    'key' VALUE 'APP_DOMAIN_NAME',
                       'value' VALUE pck_api_settings.read('APP_DOMAIN_NAME')
                )
            )
        );

        pck_api_audit.info('Recover password',
                           pck_api_audit.attributes('username', p_username, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            r_error := 'something.went.wrong';
            pck_api_audit.error('Recover password',
                                pck_api_audit.attributes('username', p_username, 'uuid', v_uuid, 'error',
                                                         r_error));

    END post_recover_password;

    PROCEDURE post_reset_password (
        p_username     app_users.username%TYPE,
        p_password     app_users.password%TYPE,
        p_token        app_tokens.token%TYPE,
        r_accesstoken  OUT VARCHAR2,
        r_refreshtoken OUT VARCHAR2,
        r_errors       OUT SYS_REFCURSOR,
        r_error        OUT VARCHAR2
    ) AS

        v_uuid     app_users.uuid%TYPE;
        c_salt     VARCHAR2(32 CHAR) := dbms_random.string('X', 32);
        v_password app_users.password%TYPE := c_salt
                                              || dbms_crypto.hash(
            utl_raw.cast_to_raw(trim(p_password) || c_salt),
            4
        );
    BEGIN
        pck_api_validate.validate('password',
                                  p_password,
                                  pck_api_validate.rule('regexp',
                                                        pck_api_settings.read('APP_AUTH_PASSWORD_REQUIREMENTS'),
                                                        pck_api_settings.read('APP_AUTH_PASSWORD_MESSAGE')),
                                  r_error,
                                  r_errors);

        IF r_error IS NOT NULL THEN
            pck_api_audit.warn('Signup',
                               pck_api_audit.attributes('username', p_username, 'error', r_error));

            r_error := NULL;
            RETURN;
        END IF;

        BEGIN
            SELECT
                uuid
            INTO v_uuid
            FROM
                app_users
            WHERE
                uuid IN (
                    SELECT
                        uuid
                    FROM
                        app_tokens
                    WHERE
                            token = p_token
                        AND type_id = 'VERIFY'
                        AND expiration > systimestamp
                )
                AND username = TRIM(upper(p_username));

        EXCEPTION
            WHEN no_data_found THEN
                r_error := 'invalid.token';
                pck_api_audit.warn('Reset password',
                                   pck_api_audit.attributes('username', p_username, 'error', r_error, 'uudi',
                                                            v_uuid));

                RETURN;
        END;

        UPDATE app_users
        SET
            password = v_password,
            attempts = 0,
            attempted = NULL,
            status = 'A',
            accessed = systimestamp
        WHERE
            uuid = v_uuid;

        COMMIT;
        pck_api_auth.revoke_token(v_uuid, 'VERIFY');
        pck_api_auth.revoke_token(v_uuid, 'REFRESH');
        r_accesstoken := pck_api_auth.issue_token(v_uuid, 'ACCESS');
        r_refreshtoken := pck_api_auth.issue_token(v_uuid, 'REFRESH');
        pck_api_audit.info('Reset password successful',
                           pck_api_audit.attributes('username', p_username, 'uuid', v_uuid));

    EXCEPTION
        WHEN OTHERS THEN
            r_accesstoken := NULL;
            r_refreshtoken := NULL;
            r_error := 'something.went.wrong';
            pck_api_audit.error('Reset password error',
                                pck_api_audit.attributes('username', p_username, 'uuid', v_uuid, 'error',
                                                         r_error));

    END post_reset_password;

    PROCEDURE post_heartbeat AS
    BEGIN
        IF pck_api_auth.uuid IS NULL THEN
            pck_api_auth.http_401;
        END IF;
    END post_heartbeat;

    PROCEDURE post_audit (
        p_data IN CLOB
    ) AS
    BEGIN
        pck_api_audit.bulk(p_data);
    END post_audit;

    PROCEDURE post_user (
        p_data   CLOB,
        r_errors OUT SYS_REFCURSOR,
        r_error  OUT VARCHAR2
    ) AS

        v_uuid     app_users.uuid%TYPE := pck_api_auth.uuid;
        v_fullname app_users.fullname%TYPE := JSON_VALUE(p_data, '$.fullname');
    BEGIN
        IF v_uuid IS NULL THEN
            pck_api_auth.http_401;
            RETURN;
        END IF;
        pck_api_validate.validate('fullname',
                                  v_fullname,
                                  pck_api_validate.rule('required', NULL, 'full.name.is.required'),
                                  r_error,
                                  r_errors);

        IF r_error IS NOT NULL THEN
            RETURN;
        END IF;
        UPDATE app_users
        SET
            fullname = v_fullname
        WHERE
            uuid = v_uuid;

        COMMIT;
        pck_api_audit.info('Profile',
                           pck_api_audit.attributes('uuid', v_uuid, 'fullname', v_fullname));

    EXCEPTION
        WHEN OTHERS THEN
            pck_api_audit.error('Profile',
                                pck_api_audit.attributes('uuid', v_uuid, 'fullname', v_fullname));

            r_error := 'something.went.wrong';
    END post_user;

BEGIN
    WITH edition AS (
        SELECT
            lower(sys_context('USERENV', 'CURRENT_EDITION_NAME')) AS name
        FROM
            dual
    )
    SELECT
        replace(
            substr(name,
                   instr(name, '_v') + 1),
            '_',
            '.'
        ) AS version
    INTO g_version
    FROM
        edition;

END pck_app;
/


-- sqlcl_snapshot {"hash":"4779f163216b2ddb715e366fb8422d581ba3a97a","type":"PACKAGE_BODY","name":"PCK_APP","schemaName":"ODBVUE","sxml":""}