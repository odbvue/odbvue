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

    PROCEDURE post_heartbeat; -- Procedure to keep the session alive
END pck_app;
/


-- sqlcl_snapshot {"hash":"9b395e8bfb324723c8cd24a781f15456d04234a5","type":"PACKAGE_SPEC","name":"PCK_APP","schemaName":"ODBVUE","sxml":""}