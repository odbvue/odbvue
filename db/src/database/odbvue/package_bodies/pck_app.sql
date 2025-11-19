CREATE OR REPLACE PACKAGE BODY odbvue.pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    PROCEDURE get_context (
        r_version OUT VARCHAR2
    ) IS
    BEGIN
        r_version := g_version;
    END get_context;

BEGIN
    SELECT
        replace(
            lower(regexp_replace(
                sys_context('USERENV', 'CURRENT_EDITION_NAME'),
                '^[A-Z0-9#$_]+_V_',
                'v'
            )),
            '_',
            '.'
        )
    INTO g_version
    FROM
        dual;

END pck_app;
/


-- sqlcl_snapshot {"hash":"e4725e49c20d43aac075cb2174a069e80b700c03","type":"PACKAGE_BODY","name":"PCK_APP","schemaName":"ODBVUE","sxml":""}