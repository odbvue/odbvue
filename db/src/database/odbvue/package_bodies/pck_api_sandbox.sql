create or replace 
PACKAGE BODY ODBVUE.pck_api_sandbox AS 
    PROCEDURE whoami
    AS
        TYPE t_attr_list IS TABLE OF VARCHAR2(64);
        v_attrs t_attr_list := t_attr_list(
        'SESSION_USER',
        'CURRENT_USER',
        'CURRENT_SCHEMA',
        'CURRENT_SCHEMAID',
        'SESSIONID',
        'HOST',
        'IP_ADDRESS',
        'OS_USER',
        'TERMINAL',
        'DB_NAME',
        'INSTANCE_NAME',
        'SERVICE_NAME',
        'MODULE',
        'ACTION',
        'CLIENT_IDENTIFIER',
        'AUTHENTICATED_IDENTITY',
        'PROXY_USER',
        'CURRENT_EDITION_NAME',
        'ENTRYID',
        'LANG',
        'LANGUAGE'
        );
        FUNCTION toCamelCase(p_str IN VARCHAR2) RETURN VARCHAR2 IS
            v_result VARCHAR2(4000);
            v_next_upper BOOLEAN := FALSE;  
    BEGIN
        FOR i IN 1 .. LENGTH(p_str) LOOP
            IF SUBSTR(p_str, i, 1) = '_' THEN
                v_next_upper := TRUE;
            ELSIF v_next_upper THEN
                v_result := v_result || UPPER(SUBSTR(p_str, i, 1));
                v_next_upper := FALSE;
            ELSE
                v_result := v_result || LOWER(SUBSTR(p_str, i, 1));
            END IF;
        END LOOP;
        RETURN v_result;
    END toCamelCase;

    BEGIN
        DBMS_OUTPUT.PUT_LINE('whoami:');
        FOR i IN 1 .. v_attrs.COUNT LOOP    
        begin
            DBMS_OUTPUT.PUT_LINE('  ' || toCamelCase(v_attrs(i)) || ': ' || SYS_CONTEXT('USERENV', v_attrs(i)));
        EXCEPTION
            when others then DBMS_OUTPUT.PUT_LINE('  ' || toCamelCase(v_attrs(i)) || ': <not available>');
        end;


        END LOOP;
    END whoami;

END pck_api_sandbox;
/



-- sqlcl_snapshot {"hash":"0a56fd7edb4b67fc894d57e39edaa3b350bd09d0","type":"PACKAGE_BODY","name":"PCK_API_SANDBOX","schemaName":"ODBVUE","sxml":""}