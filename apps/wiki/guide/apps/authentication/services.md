# Authentication services

In this section the services needed for authentication will be created.

## Overview

The authentication service provides a comprehensive security framework built on JWT (JSON Web Tokens) and password-based authentication. It handles user credential verification, secure token generation and management, role-based access control, and configurable security policies including rate limiting and account lockout protection.

**Core Features:**
- **User Authentication**: Validates usernames and passwords with salted SHA-256 hashing
- **JWT Token Management**: Issues, validates, and revokes access and refresh tokens with configurable expiration times
- **Security Policies**: Implements progressive delay mechanisms after failed login attempts, safe attempt thresholds, and maximum lockout durations to prevent brute force attacks
- **Account Status Control**: Supports account deactivation (status='D') with appropriate HTTP responses (403 Forbidden)
- **Rate Limiting**: Returns 429 (Too Many Requests) when rate limits are exceeded based on attempt history
- **Audit Logging**: Integrates with audit system to track all authentication events including login attempts, token operations, and errors

## Authentication methods

Settings needed for authentication

::: details source
```sql
MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_SAFE_ATTEMPTS' AS id, 'App authentication safe attempts' AS name, '5' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_BASE_DELAY' AS id, 'App authentication base delay in seconds' AS name, '5' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_MAX_DELAY' AS id, 'App authentication max delay in seconds' AS name, '3600' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_ISSUER' AS id, 'App authentication JWT issuer' AS name, 'OdbVue' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_AUDIENCE' AS id, 'App authentication JWT audience' AS name, 'OdbVue Audience' AS value FROM dual) s
ON (d.id = s.id)
WHEN MATCHED THEN
    UPDATE SET
        d.name = s.name,
        d.value = s.value
WHEN NOT MATCHED THEN
    INSERT (id, name, value)
    VALUES (s.id, s.name, s.value);

MERGE INTO app_settings d
USING (SELECT 'APP_AUTH_JWT_SECRET' AS id, 'App authentication JWT secret' AS name, DBMS_RANDOM.STRING('A', 200) AS value FROM dual) s
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

Methods for login with username and password, logout and obtaining refresh token.

#### `/db/src/package_specs/pck_app.sql`

::: details source
```plsql
CREATE OR REPLACE PACKAGE odbvue.pck_app AS -- Package for the main application     
    PROCEDURE get_context ( -- Returns application context
        r_version OUT VARCHAR2, -- Application version
        r_user    OUT SYS_REFCURSOR -- User data
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

END pck_app;
/
```
:::

#### `/db/src/package_bodies/pck_app.sql`

::: details source
```plsql
CREATE OR REPLACE PACKAGE BODY odbvue.pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    PROCEDURE get_context (
        r_version OUT VARCHAR2,
        r_user    OUT SYS_REFCURSOR
    ) IS
        v_uuid app_users.uuid%TYPE := pck_api_auth.uuid;
    BEGIN
        r_version := g_version;
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

