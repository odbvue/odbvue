create or replace package body odbvue.pck_demo as /*
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
    procedure get_test (
        r_test out varchar2
    ) as
    begin
        r_test := 'Test A';
    end get_test;

    procedure get_test (
        p_param1 in varchar2,
        p_param2 in number,
        p_param3 in varchar2 default 'TEST',
        p_param4 in number default 123,
        r_tests  out sys_refcursor,
        r_test   out varchar2
    ) as
    begin
        r_test := 'Test B';
        open r_tests for select
                                                                                'param1' as key,
                                                                                p_param1 as val
                                                                            from
                                                                                dual
                                                           union all
                                                           select
                                                               'param2'          as key,
                                                               to_char(p_param2) as val
                                                           from
                                                               dual
                                          union all
                                          select
                                              'param3' as key,
                                              p_param3 as val
                                          from
                                              dual
                         union all
                         select
                             'param4'          as key,
                             to_char(p_param4) as val
                         from
                             dual;

    end get_test;

    procedure delete_test as
    begin
        null;
    end delete_test;

end pck_demo;
/


-- sqlcl_snapshot {"hash":"ee21abf6ad46ecd2124265554225d0210f4fa06a","type":"PACKAGE_BODY","name":"PCK_DEMO","schemaName":"ODBVUE","sxml":""}