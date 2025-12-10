-- liquibase formatted sql
-- changeset ODBVUE:1765374634087 stripComments:false  logicalFilePath:feattravail\odbvue\package_specs\pck_tra.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_tra.sql:474a660b4195d4d9de595da038a316330db25e0c:e0ae749f29b257072c571ac769d8391dd05021bf:alter

CREATE OR REPLACE PACKAGE odbvue.pck_tra AS
    PROCEDURE get_boards ( -- Method to get list of plans
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format 
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_boards OUT SYS_REFCURSOR -- Resulting plan list
    );

    PROCEDURE get_tasks ( -- Method to get list of tasks
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format 
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_tasks  OUT SYS_REFCURSOR -- Resulting task list
    );

    PROCEDURE post_task ( -- Method to create or update a task
        p_data   CLOB, -- Task data in JSON format
        r_error  OUT VARCHAR2, -- Error message if any
        r_errors OUT SYS_REFCURSOR -- Resulting errors if any
    );

    PROCEDURE get_assignees ( -- Method to get list of assignees
        p_filter    IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format
        p_search    IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset    IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit     IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_assignees OUT SYS_REFCURSOR -- Resulting assignee list
    );

    PROCEDURE get_notes ( -- Method to get list of notes for a task
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_notes  OUT SYS_REFCURSOR -- Resulting note list
    );

    PROCEDURE post_note ( -- Method to create or update a note
        p_data   CLOB, -- Note data in JSON format
        r_error  OUT VARCHAR2, -- Error message if any
        r_errors OUT SYS_REFCURSOR -- Resulting errors if any
    );

    PROCEDURE get_download (
        p_id IN VARCHAR2 -- Storage identifier of the file
    );

    PROCEDURE job_assistant; -- Procedure to run assistant jobs for tasks
END pck_tra;
/

