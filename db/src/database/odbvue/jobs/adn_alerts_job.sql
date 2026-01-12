BEGIN
    dbms_scheduler.create_job(
        job_name      => '"ODBVUE"."ADN_ALERTS_JOB"',
        program_name  => '"ODBVUE"."ADN_ALERTS_PROGRAM"',
        job_style     => 'REGULAR',
        schedule_name => '"ODBVUE"."ADN_ALERTS_SCHEDULE"',
        job_class     => 'DEFAULT_JOB_CLASS',
        comments      => 'Refresh Admin Alerts',
        auto_drop     => TRUE
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."ADN_ALERTS_JOB"',
        attribute => 'logging_level',
        value     => dbms_scheduler.logging_off
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."ADN_ALERTS_JOB"',
        attribute => 'job_priority',
        value     => 3
    );

END;
/


-- sqlcl_snapshot {"hash":"6e273b8370f944783e4a8666ed21cfecfd1d3700","type":"JOB","name":"ADN_ALERTS_JOB","schemaName":"ODBVUE","sxml":""}