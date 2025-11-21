SET SERVEROUTPUT ON;

DECLARE
    c CLOB;
    id app_consents.id%TYPE;
BEGIN
    c := pck_api_consents.lookup();
    DBMS_OUTPUT.PUT_LINE('Consents: ' || SUBSTR(c,1,200) || '...');

    id := JSON_VALUE(c, '$[0].id');
    DBMS_OUTPUT.PUT_LINE('First Consent ID: ' || id);

    c:= pck_api_consents.download(id);
    DBMS_OUTPUT.PUT_LINE('Consent Content: ' || SUBSTR(c,1,200) || '...');

END;
/