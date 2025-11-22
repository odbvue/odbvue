-- liquibase formatted sql
-- changeset ODBVUE:1763797299885 stripComments:false  logicalFilePath:featverify-email\odbvue\package_bodies\pck_app.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_app.sql:d07feaf294cc9d36ba18de22d0f1b92265c2569a:9c0cb8547f35adbf8e37c8003cebb4d8889ddda6:alter

CREATE OR REPLACE PACKAGE BODY odbvue.pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    PROCEDURE get_context (
        r_version  OUT VARCHAR2,
        r_user     OUT SYS_REFCURSOR,
        r_consents OUT SYS_REFCURSOR
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

        IF v_uuid IS NULL THEN
            RETURN;
        END IF;
        OPEN r_user FOR SELECT
                                            uuid     AS "uuid",
                                            username AS "username",
                                            fullname AS "fullname",
                                            created  AS "created"
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

        PROCEDURE errors (
            p_name    VARCHAR2,
            p_message VARCHAR2
        ) AS
        BEGIN
            OPEN r_errors FOR SELECT
                                  p_name    AS "name",
                                  p_message AS "message"
                              FROM
                                  dual;

        END errors;

        FUNCTION audit_attrs RETURN app_audit.attributes%TYPE IS
        BEGIN
            RETURN pck_api_audit.attributes('username', p_username, 'password', '********', 'fullname',
                                            p_fullname, 'consent', p_consent, 'error', r_error,
                                            'uuid', v_uuid);
        END audit_attrs;

    BEGIN
        r_error := pck_api_validate.validate(p_username,
                                             JSON_ARRAY(
                                        JSON_OBJECT(
                                            'type' VALUE 'email',
                                            'message' VALUE 'username.must.be.valid.email.address'
                                        )
                                    ));

        IF r_error IS NOT NULL THEN
            errors('username', r_error);
            pck_api_audit.warn('Signup', audit_attrs);
            r_error := NULL;
            RETURN;
        END IF;

        r_error := pck_api_validate.validate(p_password,
                                             JSON_ARRAY(
                                        JSON_OBJECT(
                                            'type' VALUE 'regexp',
                                                    'params' VALUE pck_api_settings.read('APP_AUTH_PASSWORD_REQUIREMENTS'),
                                                    'message' VALUE pck_api_settings.read('APP_AUTH_PASSWORD_MESSAGE')
                                        )
                                    ));

        IF r_error IS NOT NULL THEN
            errors('password', r_error);
            pck_api_audit.warn('Signup', audit_attrs);
            r_error := NULL;
            RETURN;
        END IF;

        r_error := pck_api_validate.validate(p_fullname,
                                             JSON_ARRAY(
                                        JSON_OBJECT(
                                            'type' VALUE 'required',
                                            'message' VALUE 'full.name.is.required'
                                        )
                                    ));

        IF r_error IS NOT NULL THEN
            errors('fullname', r_error);
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
                errors('username', r_error);
                pck_api_audit.warn('Signup', audit_attrs);
                r_error := NULL;
                RETURN;
        END;

        r_access_token := pck_api_auth.issue_token(v_uuid, 'ACCESS');
        r_refresh_token := pck_api_auth.issue_token(v_uuid, 'REFRESH');
        pck_api_auth.revoke_token(v_uuid, 'VERIFY');
        v_verify_token := pck_api_auth.issue_token(v_uuid, 'VERIFY');
        v_email_template := pck_api_settings.read('APP_EMAIL_VERIFY_TEMPLATE');
        v_email_template := replace(v_email_template,
                                    '{{APP_DOMAIN_NAME}}',
                                    pck_api_settings.read('APP_DOMAIN_NAME'));
        v_email_template := replace(v_email_template, '{{APP_EMAIL_VERIFY_TOKEN}}', v_verify_token);
        pck_api_emails.mail(v_email_id,
                            trim(p_username),
                            p_fullname,
                            'Message from OdbVue',
                            v_email_template);
        BEGIN
            pck_api_emails.send(v_email_id);
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;
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

    PROCEDURE post_heartbeat AS
    BEGIN
        IF pck_api_auth.uuid IS NULL THEN
            pck_api_auth.http_401;
        END IF;
    END post_heartbeat;

BEGIN
    SELECT
        replace(
            lower(regexp_replace(
                sys_context('USERENV', 'CURRENT_EDITION_NAME'),
                '^[A-Z0-9#$_]+_V_',
                'v'
            )),
            '_',
            '.'
        )
    INTO g_version
    FROM
        dual;

END pck_app;
/

