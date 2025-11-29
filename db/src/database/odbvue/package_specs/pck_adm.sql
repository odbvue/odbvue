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

    PROCEDURE get_emails ( -- Get email logs with filtering and pagination
        p_filter VARCHAR2 DEFAULT NULL, -- filters (as UrlEncoded JSON)
        p_limit  PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_emails OUT SYS_REFCURSOR -- ref cursor for email records [{id, created, to_address, subject, status, message_id}]
    );

END pck_adm;
/


-- sqlcl_snapshot {"hash":"becaa6fc21a53dc6b797f990f40bd3f907b9843d","type":"PACKAGE_SPEC","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}