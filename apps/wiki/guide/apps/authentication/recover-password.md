# Recover password

## Overview

The password recovery feature allows users to reset forgotten passwords securely. The process involves two steps: first, users request a recovery email using their username, which sends a verification token; then, they use this token to set a new password. Tokens expire after a set time and can only be used once. Passwords are validated against configured requirements and securely hashed before storage.

## API

Template for password recovery email

::: details source
```sql
MERGE INTO app_settings d
USING (SELECT 
    'APP_EMAIL_RECOVER_TEMPLATE' AS id, 
    'Password recovery template with {{APP_DOMAIN_NAME}} and {{APP_PASSWORD_RESET_TOKEN}}' AS name, 
    q'[<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:Arial,sans-serif;color:#333;background:#f5f5f5;margin:0;padding:0}.container{max-width:600px;margin:20px auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.1);overflow:hidden}.header{background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:40px 20px;text-align:center}.header h1{margin:0;font-size:28px;font-weight:bold}.content{padding:40px 20px;text-align:center}.content p{margin:15px 0;font-size:16px;line-height:1.6}.button{display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;margin:20px 0;transition:opacity .3s}.button:hover{opacity:.9}.footer{background:#f9f9f9;padding:20px;text-align:center;border-top:1px solid #eee;font-size:12px}.footer a{color:#999;text-decoration:none}.footer a:hover{text-decoration:underline}</style></head><body><div class="container"><div class="header"><h1>Reset Your Password</h1></div><div class="content"><p>We received a request to reset your password. Click the button below to create a new password.</p><a href="{{APP_DOMAIN_NAME}}/reset-password/{{APP_PASSWORD_RESET_TOKEN}}" class="button">Reset Password</a><p style="font-size:14px;color:#666">Or copy and paste this link in your browser:</p><p style="font-size:12px;color:#999;word-break:break-all">{{APP_DOMAIN_NAME}}/reset-password/{{APP_PASSWORD_RESET_TOKEN}}</p></div><div class="footer"><p>If you did not request a password reset, you can safely ignore this email.</p></div></div></body></html>]' AS value FROM dual) s
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

Methods for password recovery and reset

#### `./db/src/database/odbvue/package_specs/pck_app.sql`

::: details specification
```plsql
    PROCEDURE post_recover_password ( -- Procedure initiates sending of email to recover password
        p_username app_users.username%TYPE, -- Username (e-mail address)
        r_error    OUT VARCHAR2 -- Error (NULL if sucess)
    );

    PROCEDURE post_reset_password ( -- Procedure resets user password
        p_username     app_users.username%TYPE, -- Username (e-mail address)
        p_password     app_users.password%TYPE, -- Password
        p_token        app_tokens.token%TYPE, --  Password recovery token (sent by e-mail)
        r_accesstoken  OUT VARCHAR2, -- Access token
        r_refreshtoken OUT VARCHAR2, -- Refresh token
        r_errors       OUT SYS_REFCURSOR, -- Errors [{name, message}] (NULL if success)
        r_error        OUT VARCHAR2 -- Error (NULL if success)
    );
```
:::

#### `./db/src/database/odbvue/package_bodies/pck_app.sql`
::: details implementation
```plsql
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

    BEGIN
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
```
:::

## Store

Methods fore resetting password

#### `@/stores/app/auth.ts`

::: details source
```ts
// ...

    const recoverPassword = async (username: string): Promise<boolean> => {
      startLoading()
      const { data, error } = await api.post<{error: string}>('app/recover-password/', {
        username,
      })
      if (data?.error || error) {
        setError(data?.error || 'something.went.wrong')
      } else {
        setInfo('password.recovery.email.sent')
      }
      stopLoading()
      return !data?.error
    }

    type ResetPasswordResponse = {
      access_token: string
      refresh_token: string
      error?: string
      errors?: { name: string; message: string }[]
    }

    const resetPassword = async (
      username: string,
      password: string,
      token: string,
    ): Promise<ResetPasswordResponse | null> => {
      startLoading()
      const { data, error } = await api.post<ResetPasswordResponse>('app/reset-password/', {
        username,
        password,
        token,
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
      // ...
      recoverPassword,
      resetPassword,
    }
```
:::

## Views

#### `@/pages/recover-password.vue`

::: details source
<<< ../../../../src/pages/recover-password.vue
:::

#### `@/pages/reset-password/[token].vue`

::: details source 
<<< ../../../../src/pages/reset-password/[token].vue
:::

#### `@/src/pages/login.vue`

```vue
{{ t('not.registered.yet') }}
<a href="/signup">{{ t('sign.up') }}</a>
|
<a href="/recover-password">{{ t('forgot.password') }}</a>
```
