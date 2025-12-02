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

    PROCEDURE get_settings ( -- Get application settings
        p_search   VARCHAR2 DEFAULT NULL, -- search term (job name)
        p_limit    PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset   PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_settings OUT SYS_REFCURSOR -- ref cursor for settings records [{key, name, value, secret, options}]
    );

    PROCEDURE post_setting ( -- Update application settings
        p_id     VARCHAR2, -- setting key
        p_value  VARCHAR2, -- new value
        r_errors OUT SYS_REFCURSOR -- ref cursor for validation errors [{name, message}]
    );

    PROCEDURE job_stats; -- Scheduled job to aggregate application statistics

    PROCEDURE get_stats ( -- Get application statistics 
        r_stats OUT SYS_REFCURSOR -- ref cursor for statistics records [{period_type, period_label, metric_name, metric_value}]
    );

    PROCEDURE job_alerts; -- Scheduled job to check for alerts

    PROCEDURE get_alerts ( -- Get application alerts
        r_alerts OUT SYS_REFCURSOR -- ref cursor for alert records [{alert_type, message, created}]
    );

END pck_adm;
/


-- sqlcl_snapshot {"hash":"34dfad627ba4c52f1f6bf2a7bbe28c8a03e7a1f2","type":"PACKAGE_SPEC","name":"PCK_ADM","schemaName":"ODBVUE","sxml":""}