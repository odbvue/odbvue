-- liquibase formatted sql
-- changeset ODBVUE:hotfix_pck_app stripComments:false runOnChange:true logicalFilePath:hotfix\odbvue\package_specs\pck_app.sql

CREATE OR REPLACE PACKAGE odbvue.pck_app AS -- Package for the main application

    PROCEDURE get_context ( -- Returns application context
        r_version  OUT VARCHAR2, -- Application version
        r_user     OUT SYS_REFCURSOR, -- User data [{uuid, username, fullname, created}]
        r_consents OUT SYS_REFCURSOR, -- Consents [{id, language, name, created}]
        r_config   OUT SYS_REFCURSOR -- Configuration [{key, value}]
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

    PROCEDURE post_confirm_email ( -- Procedure confirms email address
        p_token app_tokens.token%TYPE, --  Email confirmation token (sent by e-mail)
        r_error OUT VARCHAR2 -- Error (NULL if sucess)
    );

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

    PROCEDURE post_heartbeat; -- Procedure to keep the session alive

    PROCEDURE post_audit ( -- Procedure to log audit events
        p_data IN CLOB -- Audit data [{severity, message, attributes, created}]
    );

    PROCEDURE post_user ( -- Method to update user profile
        p_data   CLOB, -- Data (fullname)
        r_errors OUT SYS_REFCURSOR, -- Errors [{name, message}] (NULL if success)
        r_error  OUT VARCHAR2 -- Error (NULL if success)
    );

END pck_app;
/
