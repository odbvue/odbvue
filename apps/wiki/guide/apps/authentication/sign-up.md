# Sign up

## Overview

The sign-up process allows new users to create an account by providing a username (email address), password, full name, and accepting the terms of service. The system validates the input, creates the user account, issues authentication tokens, and sends a confirmation email to verify the email address. Password requirements are configurable in settings.

## Api

1. Settings for password verification rules (regexp) and for email verification template.

::: details source
```sql
SET DEFINE OFF;

MERGE INTO app_settings d
USING (SELECT 
    'APP_AUTH_PASSWORD_REQUIREMENTS' AS id, 
    'App authentication password requirements (12..120 chars, at least one upper letter, lower letter, number and symbol)' AS name, 
    '^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\[\]{};:",.<>/?-]).{12,120}$' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 
    'APP_AUTH_PASSWORD_MESSAGE' AS id, 
    'App authentication password requirements message (12..120 chars, at least one upper letter, lower letter, number and symbol)' AS name, 
    'password.must.be.12-120.characters.long.with.at.least.one.upper.case.letter.,.lower.case.letter.,.number.and.special.symbol' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 
    'APP_DOMAIN_NAME' AS id, 
    'App domain name' AS name, 
    'https://apps.odbvue.com' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);


MERGE INTO app_settings d
USING (SELECT 
    'APP_EMAIL_VERIFY_TEMPLATE' AS id, 
    'Email verification template with {{APP_DOMAIN_NAME}} and {{APP_EMAIL_VERIFY_TOKEN}}' AS name, 
    q'[<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#333;background:#f5f5f5;margin:0;padding:0}.container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px 20px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:bold}.content{padding:40px 20px;text-align:center}.content p{margin:15px 0;font-size:16px;line-height:1.6}.button{display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;margin:20px 0;transition:opacity .3s}.button:hover{opacity:.9}.footer{background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;font-size:12px}.footer a{color:#999;text-decoration:none}.footer a:hover{text-decoration:underline}</style></head><body><div class="container"><div class="header"><h1>Confirm Your Email</h1></div><div class="content"><p>Thank you for signing up! Please confirm your email address to get started.</p><a href="{{APP_DOMAIN_NAME}}/confirm-email/{{APP_EMAIL_VERIFY_TOKEN}}" class="button">Confirm Email</a><p style="font-size:14px;color:#666">Or copy and paste this link in your browser:</p><p style="font-size:12px;color:#999;word-break:break-all">{{APP_DOMAIN_NAME}}/confirm-email/{{APP_EMAIL_VERIFY_TOKEN}}</p></div><div class="footer"><p>If you did not sign up for this account, you can <a href="{{APP_DOMAIN_NAME}}/unsubscribe">unsubscribe</a> here.</p></div></div></body></html>]' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);
```
:::

2. Refactor App package to handle sign-up

#### `.db/src/database/odbvue/package_specs/pck_app.sql`

::: details source
```plsql
CREATE OR REPLACE PACKAGE odbvue.pck_app AS -- Package for the main application     
    PROCEDURE get_context ( -- Returns application context
        r_version  OUT VARCHAR2, -- Application version
        r_user     OUT SYS_REFCURSOR, -- User data [{uuid, username, fullname, created}]
        r_consents OUT SYS_REFCURSOR -- Consents [{id, language, name, created}]
    );

    PROCEDURE post_login ( -- Procedure authenticates user and returns tokens (PUBLIC)
        p_username      app_users.username%TYPE, -- User name (e-mail address)
        p_password      app_users.password%TYPE, -- Password
        r_access_token  OUT app_tokens.token%TYPE, -- Token
        r_refresh_token OUT app_tokens.token%TYPE -- Refresh token
    );

    PROCEDURE post_logout; -- Procedure invalidates access and refresh tokens

    PROCEDURE post_refresh ( -- Procedure re-issues access and refresh tokens
        r_access_token  OUT app_tokens.token%TYPE, -- Token
        r_refresh_token OUT app_tokens.token%TYPE -- Refresh token
    );

    PROCEDURE get_consent ( -- Procedure returns list of consents (PUBLIC)
        p_id      app_consents.id%TYPE, -- Consent id
        r_consent OUT CLOB -- Consent
    );

    PROCEDURE post_signup ( -- Procedure registers and authenticates user and returns token and context data (PUBLIC)
        p_username      app_users.username%TYPE, -- User name (e-mail address)
        p_password      app_users.password%TYPE, -- Password
        p_fullname      app_users.fullname%TYPE, -- Full name
        p_consent       app_consents.id%TYPE, -- Consent id
        r_access_token  OUT app_tokens.token%TYPE, -- Token
        r_refresh_token OUT app_tokens.token%TYPE, -- Refresh token
        r_errors        OUT SYS_REFCURSOR, -- Errors [{name, message}] (NULL if success)
        r_error         OUT VARCHAR2 -- Error (NULL if success)
    );

    PROCEDURE post_heartbeat; -- Procedure to keep the session alive
END pck_app;
/
```
:::

#### `.db/src/database/odbvue/package_bodies/pck_app.sql

::: details source
```plsql
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
```
:::

## Stores

Refactored Main and auth stores:

- context (version, user, consents) to main App Store

- `signup` method to Auth Store

#### `@/stores/index.ts`

::: details source
```ts
// ...

export const useAppStore = defineStore(
  'app',
  () => {
    // ..

    type ContextResponse = {
      // ..
      consents: {
        id: string
        language: string
        name: string
        created: string
      }[]
    }

    // ..
    const consents = ref<ContextResponse['consents']>([])

    const api = useHttp()

    async function init() {
      // ..
      consents.value = data?.consents ?? []
    }

    onMounted(async () => {
      await init()
    })

    return {
      // ..
      consents,
      // ..
    }
  },
  // ..
)
// ..
```
:::

#### `@/stores/app/auth.ts`

::: details source
```ts
// ..

export const useAuthStore = defineStore(
  'auth',
  () => {
    // ..

    type SignupResponse = {
      access_token: string
      refresh_token: string
      error?: string
      errors?: { name: string; message: string }[]
    }

    const signup = async (
      username: string,
      password: string,
      fullname: string,
      consent: string,
    ): Promise<SignupResponse | null> => {
      startLoading()
      const { data, error } = await api.post<SignupResponse>('app/signup/', {
        username,
        password,
        fullname,
        consent,
      })
      const success = data && !data?.error && !error && !data?.errors
      if (success) {
        accessToken.value = data.access_token
        Cookies.set('refresh_token', data.refresh_token, refreshCookieOptions)
        isAuthenticated.value = true
        clearMessages()
        await useAppStore().init()
      } else {
        if (data?.error || error) setError(data?.error || 'something.went.wrong')
      }
      stopLoading()
      return data
    }

    return {
      // ..
      signup,
    }
  },
  // ..
)
//..
```
:::

## Consents

New Consents composable. 

#### `@/composables/consent.ts`

::: details source
<<< ../../../../src/composables/consent.ts
:::

## Views

1. Sign-up view

#### `@/pages/signup.vue`

::: details source
<<< ../../../../src/pages/signup.vue
:::

2. Sign-up link to Login page 

#### `@/pages/login.vue`

```vue
        <br />
        <br />
        {{ t('not.registered.yet') }}
        <a href="/signup">{{ t('sign.up') }}</a>
```
