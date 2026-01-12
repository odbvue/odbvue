-- liquibase formatted sql
-- changeset ODBVUE:hotfix_pck_api_auth stripComments:false runOnChange:true logicalFilePath:hotfix\odbvue\package_specs\pck_api_auth.sql

CREATE OR REPLACE PACKAGE odbvue.pck_api_auth AS -- Package provides methods for issuing and validating tokens

    FUNCTION pwd ( -- Function returns hashed password
        p_password VARCHAR2 -- Password
    ) RETURN VARCHAR2; -- Hashed password

    PROCEDURE auth ( -- Procedure authenticates user
        p_username app_users.username%TYPE, -- Username
        p_password app_users.password%TYPE, -- Password
        r_uuid     OUT app_users.uuid%TYPE, -- User unique ID
        r_status   OUT PLS_INTEGER -- Status (200 - ok, 401 - unauthorized, 403 - forbidden, 429 - too many requests)
    );

    PROCEDURE issue_token ( -- Procedure issues a JWT token
        p_uuid  app_tokens.uuid%TYPE, -- User unique ID
        p_type  app_tokens.type_id%TYPE, -- Token type
        r_token OUT app_tokens.token%TYPE -- Token
    );

    FUNCTION issue_token ( -- Function issues a JWT token
        p_uuid app_tokens.uuid%TYPE, -- User unique ID
        p_type app_tokens.type_id%TYPE -- Token type
    ) RETURN app_tokens.token%TYPE; -- Token

    PROCEDURE revoke_token ( -- Procedure revokes a JWT token
        p_token app_tokens.token%TYPE -- Token
    );

    PROCEDURE revoke_token ( -- Procedure revokes tokens for a user (optionally filtered by type)
        p_uuid app_tokens.uuid%TYPE, -- User unique ID
        p_type app_tokens.type_id%TYPE DEFAULT NULL -- Token type
    );

    PROCEDURE cleanup ( -- Procedure removes expired tokens
        p_batch_size PLS_INTEGER DEFAULT 10000 -- Batch size
    );

    FUNCTION uuid_from_token ( -- Function returns user unique ID from JWT token passed
        p_token            app_tokens.token%TYPE, -- JWT token
        p_check_expiration CHAR DEFAULT 'Y' -- Check token expiration (Y/N)
    ) RETURN app_users.uuid%TYPE; -- User unique ID

    FUNCTION uuid (-- Function returns user unique ID from JWT token passed in the Authorization header as a Bearer token
        p_check_expiration CHAR DEFAULT 'Y' -- Check token expiration (Y/N)
    ) RETURN app_users.uuid%TYPE; -- User unique ID

    FUNCTION refresh (-- Function returns user unique ID from cookie passed in the request
        p_cookie_name      VARCHAR2 DEFAULT 'refresh_token', -- Cookie name
        p_check_expiration CHAR DEFAULT 'Y' -- Check token expiration (Y/N)
    ) RETURN app_users.uuid%TYPE; -- User unique ID

    FUNCTION role ( -- Function checks if user has role
        p_uuid app_users.uuid%TYPE DEFAULT NULL, -- User unique ID (NULL - current user from bearer token)
        p_role app_roles.role%TYPE -- Role
    ) RETURN PLS_INTEGER; -- Permission count for the role (0 - no role)

    FUNCTION perm ( -- Function checks user permission
        p_uuid       app_users.uuid%TYPE DEFAULT NULL, -- User unique ID (NULL - current user from bearer token)
        p_role       app_roles.role%TYPE, -- Role
        p_permission app_permissions.permission%TYPE -- Permission
    ) RETURN PLS_INTEGER; -- Permission (0 - no permission, 1 - has permission)

    PROCEDURE http ( -- Procedure sends HTTP status
        p_status PLS_INTEGER, -- HTTP status code
        p_error  VARCHAR2 DEFAULT NULL -- Error message
    );

    PROCEDURE http_401 ( -- Procedure sends HTTP 401 Unauthorized status
        p_error VARCHAR2 DEFAULT NULL -- Error message
    );

    PROCEDURE http_403 ( -- Procedure sends HTTP 403 Forbidden status
        p_error VARCHAR2 DEFAULT NULL -- Error message
    );

    PROCEDURE http_429 ( -- Procedure sends HTTP 429 Too Many Requests status
        p_error VARCHAR2 DEFAULT NULL -- Error message
    );

    PROCEDURE reload_settings; -- Procedure reloads token settings from the database
END;
/
