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


-- sqlcl_snapshot {"hash":"b845258cc28751004c729971aad4f396021d4b0f","type":"PROGRAM","name":"ADM_STATS_PROGRAM","schemaName":"ODBVUE","sxml":""}