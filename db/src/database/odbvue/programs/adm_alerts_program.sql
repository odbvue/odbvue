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


-- sqlcl_snapshot {"hash":"e3faad54894833877ef5bdc6dbfe70bbb5e59010","type":"PROGRAM","name":"ADM_ALERTS_PROGRAM","schemaName":"ODBVUE","sxml":""}