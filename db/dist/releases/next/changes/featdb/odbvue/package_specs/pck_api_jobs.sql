-- liquibase formatted sql
-- changeset ODBVUE:1762883860698 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_jobs.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_jobs.sql:null:69928ece873275b4fe048f350345da76a9826b79:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_jobs AS -- Package for managing jobs

    PROCEDURE add ( -- Add a new job
        p_name        VARCHAR2, -- Job name
        p_program     VARCHAR2, -- Program name (PLSQL procedure)
        p_arguments   CLOB, -- JSON array of arguments,  format [] of {type, name, value}
        p_schedule    VARCHAR2, -- Schedule interval, https://docs.oracle.com/en/database/oracle/oracle-database/19/arpls/DBMS_SCHEDULER.html#ARPLS-GUID-73622B78-EFF4-4D06-92F5-E358AB2D58F3
        p_description VARCHAR2 -- Job description
    );

    PROCEDURE remove ( -- Remove a job
        p_name VARCHAR2 -- Job name
    );

    PROCEDURE enable ( -- Enable a job
        p_name VARCHAR2 -- Job name
    );

    PROCEDURE disable ( -- Disable a job
        p_name VARCHAR2 -- Job name
    );

    PROCEDURE run ( -- Run a job
        p_name VARCHAR2 -- Job name
    );

END;
/

