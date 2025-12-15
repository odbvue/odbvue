CREATE OR REPLACE PACKAGE odbvue.pck_crm AS -- CRM

    PROCEDURE get_request ( -- Method to get requests with pagination and filtering
        p_search   IN VARCHAR2, -- Search term for filtering requests
        p_filter   IN VARCHAR2, -- Additional filter criteria
        p_offset   IN NUMBER, -- Offset for pagination
        p_limit    IN NUMBER, -- Limit for pagination
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


-- sqlcl_snapshot {"hash":"0ce41c13851123888ccc4cd4bd4d661a1ce64e4f","type":"PACKAGE_SPEC","name":"PCK_CRM","schemaName":"ODBVUE","sxml":""}