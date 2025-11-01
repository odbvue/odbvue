CREATE OR REPLACE EDITIONABLE PACKAGE BODY pck_api_sandbox AS 

    PROCEDURE whoami
    AS
    BEGIN
        DBMS_OUTPUT.PUT_LINE('Current User: ' || USER);
        DBMS_OUTPUT.PUT_LINE('Current Edition: ' || SYS_CONTEXT('USERENV', 'CURRENT_EDITION_NAME'));
    END whoami;

END pck_api_sandbox;