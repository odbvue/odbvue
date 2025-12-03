-- liquibase formatted sql
-- changeset ODBVUE:1764760292684 stripComments:false  logicalFilePath:featchore\odbvue\programs\adm_alerts_program.sql
-- sqlcl_snapshot db/src/database/odbvue/programs/adm_alerts_program.sql:null:e3faad54894833877ef5bdc6dbfe70bbb5e59010:create

BEGIN
    dbms_scheduler.create_program(
        program_name        => '"ODBVUE"."ADM_ALERTS_PROGRAM"',
        program_type        => 'STORED_PROCEDURE',
        program_action      => 'pck_adm.job_alerts',
        number_of_arguments => 0,
        enabled             => TRUE,
        comments            => NULL
    );
END;
/

