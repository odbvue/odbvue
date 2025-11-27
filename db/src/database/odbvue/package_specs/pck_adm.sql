CREATE OR REPLACE PACKAGE odbvue.pck_adm AS -- Administration package

    PROCEDURE get_audit ( -- Get audit logs with filtering and pagination
        p_filter VARCHAR2 DEFAULT NULL, -- filters (as UrlEncoded JSON)
        p_limit  PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_audit  OUT SYS_REFCURSOR -- ref cursor for audit records [{id, created, username, severity, module, message, attributes}]
    );

END pck_adm;
/


-- sqlcl_snapshot {"hash":"73fe5abfbc7343064390705b53635cd0b54dce95","type":"PACKAGE_SPEC","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}