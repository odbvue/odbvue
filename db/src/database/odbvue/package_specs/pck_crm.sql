CREATE OR REPLACE PACKAGE odbvue.pck_crm AS -- CRM

    PROCEDURE get_requests ( -- Method to get requests with pagination and filtering
        p_search   IN VARCHAR2 DEFAULT NULL, -- Search term for filtering requests
        p_filter   IN VARCHAR2 DEFAULT NULL, -- Additional filter criteria
        p_offset   IN NUMBER DEFAULT NULL, -- Offset for pagination
        p_limit    IN NUMBER DEFAULT NULL, -- Limit for pagination
        r_requests OUT SYS_REFCURSOR -- Output cursor for the requests
    );

    PROCEDURE post_request ( -- Method to post a new request (PUBLIC)
        p_name         IN VARCHAR2, -- Full name of the requester
        p_organization IN VARCHAR2, -- Organization name of the requester
        p_phone        IN VARCHAR2, -- Phone number of the requester
        p_email        IN VARCHAR2, -- Email address of the requester
        p_message      IN CLOB -- Additional message from the requester
    );

END pck_crm;
/


-- sqlcl_snapshot {"hash":"b1a6bd88b2d5c3d2773560bc8b2a4d295cd8be43","type":"PACKAGE_SPEC","name":"PCK_CRM","schemaName":"ODBVUE","sxml":""}