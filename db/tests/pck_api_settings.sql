SET SERVEROUTPUT ON;

DECLARE
    v_value app_settings.value%TYPE;
BEGIN
    pck_api_settings.write('DUMMY', 'Dummy setting', '1');
    COMMIT;

    pck_api_settings.read('DUMMY', v_value);
    DBMS_OUTPUT.PUT_LINE('Value of DUMMY setting: ' || v_value);
END;
/

DECLARE
    v_value VARCHAR2(200 CHAR) := 'This is a secret value';
BEGIN

    DBMS_OUTPUT.PUT_LINE(v_value);
    DBMS_OUTPUT.PUT_LINE('=>');
    v_value := pck_api_settings.enc(v_value);
    DBMS_OUTPUT.PUT_LINE(v_value);
    DBMS_OUTPUT.PUT_LINE('=>');
    v_value := pck_api_settings.dec(v_value);
    DBMS_OUTPUT.PUT_LINE(v_value);
    DBMS_OUTPUT.PUT_LINE('=>');
END;
/