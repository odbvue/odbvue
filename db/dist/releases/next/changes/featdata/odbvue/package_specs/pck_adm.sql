-- liquibase formatted sql
-- changeset ODBVUE:1764509623051 stripComments:false  logicalFilePath:featdata\odbvue\package_specs\pck_adm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_adm.sql:becaa6fc21a53dc6b797f990f40bd3f907b9843d:457e64db89715a95f56f8c466b7a3a960bcd57df:alter

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

    PROCEDURE get_jobs ( -- Get scheduled jobs with filtering and pagination
        p_search VARCHAR2 DEFAULT NULL, -- search term (job name)
        p_limit  PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_jobs   OUT SYS_REFCURSOR -- ref cursor for job records [{name, schedule, started, duration, comments, enabled}]
    );

    PROCEDURE get_jobs_history ( -- Get job execution history with filtering and pagination
        p_filter VARCHAR2 DEFAULT NULL, -- filters (as UrlEncoded JSON)
        p_offset NUMBER DEFAULT 0, -- offset for pagination
        p_limit  NUMBER DEFAULT 10, -- number of records to return
        r_items  OUT SYS_REFCURSOR -- ref cursor for job history records [{name, started, duration, status, output}]
    );

    PROCEDURE post_job_enable ( -- Enable a scheduled job
        p_name VARCHAR2 -- job name
    );

    PROCEDURE post_job_disable ( -- Disable a scheduled job
        p_name VARCHAR2 -- job name
    );

    PROCEDURE post_job_run ( -- Run a scheduled job
        p_name VARCHAR2 -- job name
    );

END pck_adm;
/

