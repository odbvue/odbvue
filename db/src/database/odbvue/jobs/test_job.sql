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

    dbms_scheduler.enable('"ODBVUE"."TEST_JOB"');
END;
/


-- sqlcl_snapshot {"hash":"7ff145b8106bd5dc301abbae7ffb46b2aa780358","type":"JOB","name":"TEST_JOB","schemaName":"ODBVUE","sxml":""}