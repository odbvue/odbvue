-- liquibase formatted sql
-- changeset ODBVUE:1764677783551 stripComments:false  logicalFilePath:featapp-stats\odbvue\programs\adm_stats_program.sql
-- sqlcl_snapshot db/src/database/odbvue/programs/adm_stats_program.sql:null:b845258cc28751004c729971aad4f396021d4b0f:create

BEGIN
    dbms_scheduler.create_program(
        program_name        => '"ODBVUE"."ADM_STATS_PROGRAM"',
        program_type        => 'STORED_PROCEDURE',
        program_action      => 'pck_adm.job_stats',
        number_of_arguments => 0,
        enabled             => TRUE,
        comments            => NULL
    );
END;
/

