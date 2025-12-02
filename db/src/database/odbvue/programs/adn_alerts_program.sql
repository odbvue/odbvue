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


-- sqlcl_snapshot {"hash":"d4f421d7acbfab8f3e68694c80cd022c591bff23","type":"PROGRAM","name":"ADN_ALERTS_PROGRAM","schemaName":"ODBVUE","sxml":""}