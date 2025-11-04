-- liquibase formatted sql
-- changeset ODBVUE:1762284803293 stripComments:false  logicalFilePath:featdb\odbvue\package_bodies\pck_demo.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_demo.sql:ee21abf6ad46ecd2124265554225d0210f4fa06a:733b15532520817634e3eac8d81964931beaa10a:alter

CREATE OR REPLACE PACKAGE BODY odbvue.pck_demo AS /*
    PROCEDURE get_version (
        r_version OUT VARCHAR2
    ) AS
    BEGIN
        r_version := REGEXP_REPLACE(
            SYS_CONTEXT ('USERENV', 'CURRENT_EDITION_NAME'), 
             '^.*?_v_(\d+)_(\d+)_(\d+)$', 'v\1.\2.\3', 1, 0, 'i'
    );
    END get_version;
*/
    PROCEDURE get_test (
        r_test OUT VARCHAR2
    ) AS
    BEGIN
        r_test := 'Test A';
    END get_test;

    PROCEDURE get_test (
        p_param1 IN VARCHAR2,
        p_param2 IN NUMBER,
        p_param3 IN VARCHAR2 DEFAULT 'TEST',
        p_param4 IN NUMBER DEFAULT 123,
        r_tests  OUT SYS_REFCURSOR,
        r_test   OUT VARCHAR2
    ) AS
    BEGIN
        r_test := 'Test B';
        OPEN r_tests FOR SELECT
                                                                                'param1' AS key,
                                                                                p_param1 AS val
                                                                            FROM
                                                                                dual
                                                           UNION ALL
                                                           SELECT
                                                               'param2'          AS key,
                                                               to_char(p_param2) AS val
                                                           FROM
                                                               dual
                                          UNION ALL
                                          SELECT
                                              'param3' AS key,
                                              p_param3 AS val
                                          FROM
                                              dual
                         UNION ALL
                         SELECT
                             'param4'          AS key,
                             to_char(p_param4) AS val
                         FROM
                             dual;

    END get_test;

    PROCEDURE delete_test AS
    BEGIN
        NULL;
    END delete_test;

END pck_demo;
/

