DECLARE
    v_req utl_http.req;
    v_text CLOB;
BEGIN
    BEGIN
        pck_api_http.request(v_req, 'GET', 'https://api.chucknorris.io/jokes/random');
        pck_api_http.response_text(v_req, v_text);
        DBMS_OUTPUT.PUT_LINE(JSON_VALUE(v_text, '$.value'));
    EXCEPTION
        WHEN OTHERS THEN
            DECLARE
                v_error_stack VARCHAR2(4000) := DBMS_UTILITY.FORMAT_ERROR_STACK();
            BEGIN
                IF v_error_stack LIKE '%ORA-24247%' THEN
                    DBMS_OUTPUT.PUT_LINE('ERROR (ORA-24247): Network access denied by Access Control List (ACL).');
                    DBMS_OUTPUT.PUT_LINE('ACL must be enabled first using pck_api_admin.acl_append_host.');
                ELSE
                    RAISE;
                END IF;
            END;
    END;
END;
/