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


-- sqlcl_snapshot {"hash":"b554e185fa030bfa1f8e5c3d994c3e0ac75d216f","type":"PACKAGE_SPEC","name":"PCK_APP","schemaName":"ODBVUE","sxml":""}