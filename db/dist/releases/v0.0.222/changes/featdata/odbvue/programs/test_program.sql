-- liquibase formatted sql
-- changeset ODBVUE:1764509622643 stripComments:false  logicalFilePath:featdata\odbvue\programs\test_program.sql
-- sqlcl_snapshot db/src/database/odbvue/programs/test_program.sql:null:6c69502080ca9261a747d6ac0ae893f1c2891d3c:create

BEGIN
    dbms_scheduler.create_program(
        program_name        => '"ODBVUE"."TEST_PROGRAM"',
        program_type        => 'STORED_PROCEDURE',
        program_action      => 'pck_api_audit.info',
        number_of_arguments => 0,
        enabled             => TRUE,
        comments            => NULL
    );
END;
/

