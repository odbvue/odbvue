-- liquibase formatted sql
-- changeset ODBVUE:1762259633066 stripComments:false  logicalFilePath:featordsify\odbvue\package_specs\pck_demo.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_demo.sql:null:8bd29fe2d91a506e307f4b8903716da7269d9f9b:create

create or replace package odbvue.pck_demo as -- Application 
    procedure get_test ( -- get test 1
        r_test out varchar2 -- Test Result
    );

    procedure get_test ( -- get test 2
        p_param1 in varchar2, -- Parameter 1 
        p_param2 in number, -- Parameter 2
        p_param3 in varchar2 default 'TEST', -- Parameter 3
        p_param4 in number default 123, -- Parameter 4
        r_tests  out sys_refcursor, -- Test Results [{key: val}]
        r_test   out varchar2 -- Test Result
    );

    procedure delete_test; -- Delete test
end pck_demo;
/

