CREATE OR REPLACE PACKAGE odbvue.pck_tra AS
    PROCEDURE get_tasks ( -- Method to get list of tasks
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format 
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_tasks  OUT SYS_REFCURSOR -- Resulting task list
    );

    PROCEDURE post_task ( -- Method to create or update a task
        p_key         VARCHAR2, -- Task key, if updating existing task (empty for new task)
        p_parent_key  VARCHAR2, -- Parent task key
        p_title       VARCHAR2, -- Task title
        p_description CLOB -- Task description
    );

END pck_tra;
/


-- sqlcl_snapshot {"hash":"585eeffa741d50f90b5e536ab45b9515a111e387","type":"PACKAGE_SPEC","name":"PCK_TRA","schemaName":"ODBVUE","sxml":""}