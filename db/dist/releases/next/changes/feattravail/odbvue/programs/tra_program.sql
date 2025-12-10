-- liquibase formatted sql
-- changeset ODBVUE:1765374632490 stripComments:false  logicalFilePath:feattravail\odbvue\programs\tra_program.sql
-- sqlcl_snapshot db/src/database/odbvue/programs/tra_program.sql:null:acfc4fe8a9cec32b4051f88fb8c7d06cceef1cad:create

BEGIN
    dbms_scheduler.create_program(
        program_name        => '"ODBVUE"."TRA_PROGRAM"',
        program_type        => 'STORED_PROCEDURE',
        program_action      => 'pck_tra.job_assistant',
        number_of_arguments => 0,
        enabled             => TRUE,
        comments            => NULL
    );
END;
/

