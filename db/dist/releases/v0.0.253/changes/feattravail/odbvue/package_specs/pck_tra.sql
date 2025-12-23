-- liquibase formatted sql
-- changeset ODBVUE:1766485131159 stripComments:false  logicalFilePath:feattravail\odbvue\package_specs\pck_tra.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_tra.sql:fe51f1f211c5c7f8fef23aaec1b85d574fef9e95:dd6b4b067507399146a0f6d4e4c6878fcd1b4dd1:alter

CREATE OR REPLACE PACKAGE odbvue.pck_tra AS
    PROCEDURE get_boards ( -- Method to get list of plans
        p_filter IN VARCHAR2 DEFAULT NULL, -- Filter in URL encoded JSON format 
        p_search IN VARCHAR2 DEFAULT NULL, -- Search string
        p_offset IN PLS_INTEGER DEFAULT 0, -- Offset for pagination
        p_limit  IN PLS_INTEGER DEFAULT 10, -- Limit for pagination
        r_boards OUT SYS_REFCURSOR -- Resulting plan list
    );

    PROCEDURE post_board ( -- Method to create or update a board
        p_data   CLOB, -- Board data in JSON format
        r_error  OUT VARCHAR2, -- Error message if any
        r_errors OUT SYS_REFCURSOR -- Resulting errors if any
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

    PROCEDURE post_archive ( -- Method to archive a task
        p_key    IN VARCHAR2, -- Task identifier
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

    PROCEDURE post_rank (
        p_num    IN VARCHAR2,
        p_before IN VARCHAR2,
        p_after  IN VARCHAR2
    );

END pck_tra;
/

