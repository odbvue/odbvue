CREATE OR REPLACE PACKAGE odbvue.pck_adm AS -- Administration package

    PROCEDURE get_audit ( -- Get audit logs with filtering and pagination
        p_filter VARCHAR2 DEFAULT NULL, -- filters (as UrlEncoded JSON)
        p_limit  PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_audit  OUT SYS_REFCURSOR -- ref cursor for audit records [{id, created, username, severity, module, message, attributes}]
    );

    PROCEDURE get_users ( -- Get user list with filtering and pagination
        p_search VARCHAR2 DEFAULT NULL, -- search term (username)
        p_limit  PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_users  OUT SYS_REFCURSOR -- ref cursor for user records [{id, username, email, roles, created, last_login, status}]
    );

END pck_adm;
/


-- sqlcl_snapshot {"hash":"09023192fe953675b56971a98050b3980bccc33b","type":"PACKAGE_SPEC","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}