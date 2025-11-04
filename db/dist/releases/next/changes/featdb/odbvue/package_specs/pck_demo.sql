-- liquibase formatted sql
-- changeset ODBVUE:1762284803413 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_demo.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_demo.sql:8bd29fe2d91a506e307f4b8903716da7269d9f9b:bba09c280477de834be268140c310fa28c23decf:alter

CREATE OR REPLACE PACKAGE odbvue.pck_demo AS -- Application 
    PROCEDURE get_test ( -- get test 1
        r_test OUT VARCHAR2 -- Test Result
    );

    PROCEDURE get_test ( -- get test 2
        p_param1 IN VARCHAR2, -- Parameter 1 
        p_param2 IN NUMBER, -- Parameter 2
        p_param3 IN VARCHAR2 DEFAULT 'TEST', -- Parameter 3
        p_param4 IN NUMBER DEFAULT 123, -- Parameter 4
        r_tests  OUT SYS_REFCURSOR, -- Test Results [{key: val}]
        r_test   OUT VARCHAR2 -- Test Result
    );

    PROCEDURE delete_test; -- Delete test
END pck_demo;
/

