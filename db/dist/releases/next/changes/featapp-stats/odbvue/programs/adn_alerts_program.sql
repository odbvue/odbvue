-- liquibase formatted sql
-- changeset ODBVUE:1764677783619 stripComments:false  logicalFilePath:featapp-stats\odbvue\programs\adn_alerts_program.sql
-- sqlcl_snapshot db/src/database/odbvue/programs/adn_alerts_program.sql:null:d4f421d7acbfab8f3e68694c80cd022c591bff23:create

BEGIN
    dbms_scheduler.create_program(
        program_name        => '"ODBVUE"."ADN_ALERTS_PROGRAM"',
        program_type        => 'STORED_PROCEDURE',
        program_action      => 'pck_adm.job_alerts',
        number_of_arguments => 0,
        enabled             => TRUE,
        comments            => NULL
    );
END;
/

