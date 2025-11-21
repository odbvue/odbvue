SET SERVEROUTPUT ON;

DECLARE 
    r_version varchar2(30 char);
    r_user SYS_REFCURSOR;
BEGIN
    pck_app.get_context(r_version, r_user);

    dbms_output.put_line('Application version: ' || r_version);
END;
/

SET SERVEROUTPUT ON;

DECLARE 
    a app_tokens.token%TYPE;
    r app_tokens.token%TYPE;
    e VARCHAR2(2000 CHAR);
BEGIN
    pck_app.post_signup(
        p_username => 'admin___bsbingo.com',
        p_password => 'Admin@1234eA',
        p_fullname => 'Admin User',
        p_consent => '4417734b54050087e0630201590a6287',
        r_access_token => a,
        r_refresh_token => r,
        r_error => e
    );    

    DBMS_OUTPUT.PUT_LINE('Error: ' || e);
END;
/
