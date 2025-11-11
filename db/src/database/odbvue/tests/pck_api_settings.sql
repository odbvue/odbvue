DECLARE
    v_value app_settings.value%TYPE;
BEGIN
    pck_api_settings.write('DUMMY', 'Dummy setting', '1');
    COMMIT;

    pck_api_settings.read('DUMMY', v_value);
    DBMS_OUTPUT.PUT_LINE('Value of DUMMY setting: ' || v_value);
END;
/