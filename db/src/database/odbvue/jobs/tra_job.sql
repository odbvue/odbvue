BEGIN
    dbms_scheduler.create_job(
        job_name      => '"ODBVUE"."TRA_JOB"',
        program_name  => '"ODBVUE"."TRA_PROGRAM"',
        job_style     => 'REGULAR',
        schedule_name => '"ODBVUE"."TRA_SCHEDULE"',
        job_class     => 'DEFAULT_JOB_CLASS',
        comments      => 'Travail AI Assistant',
        auto_drop     => TRUE
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TRA_JOB"',
        attribute => 'logging_level',
        value     => dbms_scheduler.logging_off
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TRA_JOB"',
        attribute => 'job_priority',
        value     => 3
    );

    dbms_scheduler.enable('"ODBVUE"."TRA_JOB"');
END;
/


-- sqlcl_snapshot {"hash":"1ce6e7e2731385d0aca24da0e5ccfb6a1a4e0b36","type":"JOB","name":"TRA_JOB","schemaName":"ODBVUE","sxml":""}