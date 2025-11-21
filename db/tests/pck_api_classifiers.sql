SET SERVEROUTPUT ON;

DECLARE
    c CLOB;
BEGIN

    DBMS_OUTPUT.PUT_LINE('Countries:');
    c:=pck_api_classifiers.lookup(
        'countries',
        'be',
        'Y',
        10,
        0
    );
    DBMS_OUTPUT.PUT_LINE(c);
    DBMS_OUTPUT.PUT_LINE('');

    DBMS_OUTPUT.PUT_LINE('Currencies:');
    c:=pck_api_classifiers.lookup(
        'currencies',
        'dollar',
        'Y',
        10,
        0
    );
    DBMS_OUTPUT.PUT_LINE(c);
    DBMS_OUTPUT.PUT_LINE('');

    DBMS_OUTPUT.PUT_LINE('Languages:');
    c:=pck_api_classifiers.lookup(
        'languages',
        'po',
        'Y',
        10,
        0
    );
    DBMS_OUTPUT.PUT_LINE(c);
    DBMS_OUTPUT.PUT_LINE('');

END;
/
