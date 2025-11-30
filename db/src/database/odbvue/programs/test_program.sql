BEGIN
    dbms_scheduler.create_program(
        program_name        => '"ODBVUE"."TEST_PROGRAM"',
        program_type        => 'STORED_PROCEDURE',
        program_action      => 'pck_api_audit.info',
        number_of_arguments => 1,
        enabled             => TRUE,
        comments            => NULL
    );
END;
/


-- sqlcl_snapshot {"hash":"6c69502080ca9261a747d6ac0ae893f1c2891d3c","type":"PROGRAM","name":"TEST_PROGRAM","schemaName":"ODBVUE","sxml":""}