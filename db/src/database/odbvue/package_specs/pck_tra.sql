CREATE OR REPLACE PACKAGE odbvue.pck_tra AS
    PROCEDURE get_plans ( -- Method to get list of plans
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format 
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_plans  OUT SYS_REFCURSOR -- Resulting plan list
    );

    PROCEDURE get_tasks ( -- Method to get list of tasks
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format 
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_tasks  OUT SYS_REFCURSOR -- Resulting task list
    );

    PROCEDURE post_task ( -- Method to create or update a task
        p_num         VARCHAR2, -- Task key, if updating existing task (empty for new task)
        p_parent_num  VARCHAR2, -- Parent task key
        p_title       VARCHAR2, -- Task title
        p_description CLOB, -- Task description
        p_due         VARCHAR2, -- Task due date
        p_priority    VARCHAR2, -- Task priority
        p_assignee    VARCHAR2 -- Task assignee
    );

    PROCEDURE get_assignees ( -- Method to get list of assignees
        p_filter    IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format
        p_search    IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset    IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit     IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_assignees OUT SYS_REFCURSOR -- Resulting assignee list
    );

END pck_tra;
/


-- sqlcl_snapshot {"hash":"cac50da68f40a966a72e25a215cffd7e195da61c","type":"PACKAGE_SPEC","name":"PCK_TRA","schemaName":"ODBVUE","sxml":""}