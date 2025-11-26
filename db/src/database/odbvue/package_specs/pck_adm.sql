CREATE OR REPLACE PACKAGE odbvue.pck_adm AS
    PROCEDURE get_audit (
        p_search VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_audit  OUT SYS_REFCURSOR
    );

END pck_adm;
/


-- sqlcl_snapshot {"hash":"5ff71cd6cced4eaf6e4db1ddd1d211df4eaf663d","type":"PACKAGE_SPEC","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}