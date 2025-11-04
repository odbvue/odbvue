create or replace 
PACKAGE ODBVUE.pck_demo AS -- Application 
    PROCEDURE get_test( -- get test 1
        r_test OUT VARCHAR2 -- Test Result
    );

    PROCEDURE get_test( -- get test 2
        p_param1 IN VARCHAR2, -- Parameter 1 
        p_param2 IN NUMBER, -- Parameter 2
        p_param3 IN VARCHAR2 DEFAULT 'TEST', -- Parameter 3
        p_param4 IN NUMBER DEFAULT 123, -- Parameter 4
        r_tests OUT SYS_REFCURSOR, -- Test Results [{key: val}]
        r_test OUT VARCHAR2 -- Test Result
    );

    PROCEDURE delete_test; -- Delete test

END pck_demo;
/



-- sqlcl_snapshot {"hash":"eb62976f4680289d77b512d9904096f9395e71b0","type":"PACKAGE_SPEC","name":"PCK_DEMO","schemaName":"ODBVUE","sxml":""}