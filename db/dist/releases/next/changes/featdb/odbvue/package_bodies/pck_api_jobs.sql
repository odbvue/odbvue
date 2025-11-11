-- liquibase formatted sql
-- changeset ODBVUE:1762883860639 stripComments:false  logicalFilePath:featdb\odbvue\package_bodies\pck_api_jobs.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_jobs.sql:null:f4d6a769b7b322cc6a1f45f191aeb0cc4817f44c:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_jobs AS

    PROCEDURE add (
        p_name        VARCHAR2,
        p_program     VARCHAR2,
        p_arguments   CLOB,
        p_schedule    VARCHAR2,
        p_description VARCHAR2
    ) AS
        v_cnt PLS_INTEGER;
    BEGIN
        remove(p_name);
        SELECT
            COUNT(*)
        INTO v_cnt
        FROM
            JSON_TABLE ( p_arguments, '$[*]'
                COLUMNS (
                    type VARCHAR2 PATH '$.type',
                    name VARCHAR2 PATH '$.name',
                    value VARCHAR2 PATH '$.value'
                )
            );

        dbms_scheduler.create_program(
            program_name        => upper(p_name)
                            || '_PROGRAM',
            program_type        => 'STORED_PROCEDURE',
            program_action      => p_program,
            number_of_arguments => v_cnt,
            enabled             => FALSE
        );

        FOR i IN 1..v_cnt LOOP
            dbms_scheduler.define_program_argument(
                program_name      => upper(p_name)
                                || '_PROGRAM',
                argument_position => i,
                argument_name     => json_value(p_arguments, '$['
                                                         ||(i - 1)
                                                         || '].name'),
                argument_type     => json_value(p_arguments, '$['
                                                         ||(i - 1)
                                                         || '].type'),
                default_value     => json_value(p_arguments, '$['
                                                         ||(i - 1)
                                                         || '].value')
            );
        END LOOP;

        dbms_scheduler.enable(upper(p_name) || '_PROGRAM');
        dbms_scheduler.create_schedule(
            schedule_name   => upper(p_name)
                             || '_SCHEDULE',
            start_date      => systimestamp,
            repeat_interval => p_schedule
        );

        dbms_scheduler.create_job(
            job_name      => upper(p_name)
                        || '_JOB',
            program_name  => upper(p_name)
                            || '_PROGRAM',
            schedule_name => upper(p_name)
                             || '_SCHEDULE',
            enabled       => FALSE,
            auto_drop     => TRUE,
            comments      => p_description
        );

        dbms_scheduler.enable(upper(p_name) || '_PROGRAM');
        dbms_scheduler.enable(upper(p_name) || '_JOB');
    END;

    PROCEDURE remove (
        p_name VARCHAR2
    ) AS
    BEGIN
        BEGIN
            dbms_scheduler.drop_job(upper(p_name)
                                    || '_JOB',
                                    TRUE);
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        BEGIN
            dbms_scheduler.drop_schedule(upper(p_name) || '_SCHEDULE');
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

        BEGIN
            dbms_scheduler.drop_program(upper(p_name) || '_PROGRAM');
        EXCEPTION
            WHEN OTHERS THEN
                NULL;
        END;

    END;

    PROCEDURE enable (
        p_name VARCHAR2
    ) AS
    BEGIN
        dbms_scheduler.enable(upper(p_name) || '_JOB');
    END;

    PROCEDURE disable (
        p_name VARCHAR2
    ) AS
    BEGIN
        dbms_scheduler.disable(upper(p_name) || '_JOB');
    END;

    PROCEDURE run (
        p_name VARCHAR2
    ) AS
    BEGIN
        dbms_scheduler.run_job(upper(p_name) || '_JOB');
    END;

END;
/

