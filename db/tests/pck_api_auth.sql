set serveroutput on;
/

DECLARE
    v_uuid CHAR(32 CHAR);
    v_token VARCHAR2(2000 char);
BEGIN  

    SELECT uuid INTO v_uuid FROM app_users WHERE username = UPPER('admin@odbvue.com');

    v_token := pck_api_auth.issue_token(v_uuid,'ACCESS');
    dbms_output.put_line('Issued Token: ');
    dbms_output.put_line(v_token);

    v_uuid := pck_api_auth.uuid_from_token(v_token);
    dbms_output.put_line('UUID from Token: ');
    dbms_output.put_line(v_uuid);

END;
/
