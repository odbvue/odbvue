BEGIN
    dbms_scheduler.create_job(
        job_name      => '"ODBVUE"."TEST_JOB"',
        program_name  => '"ODBVUE"."TEST_PROGRAM"',
        job_style     => 'REGULAR',
        schedule_name => '"ODBVUE"."TEST_SCHEDULE"',
        job_class     => 'DEFAULT_JOB_CLASS',
        comments      => 'Weekly Test Job',
        auto_drop     => TRUE
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TEST_JOB"',
        attribute => 'logging_level',
        value     => dbms_scheduler.logging_off
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TEST_JOB"',
        attribute => 'job_priority',
        value     => 3
    );

END;
/


-- sqlcl_snapshot {"hash":"1a9879cc1a1a8e609d9a5955932cfa5996ac367e","type":"JOB","name":"TEST_JOB","schemaName":"ODBVUE","sxml":""}