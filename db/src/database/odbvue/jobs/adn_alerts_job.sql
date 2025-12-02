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

    dbms_scheduler.enable('"ODBVUE"."ADN_ALERTS_JOB"');
END;
/


-- sqlcl_snapshot {"hash":"aba899e5ed4adef14abe4cf670fafc9cb760d3b5","type":"JOB","name":"ADN_ALERTS_JOB","schemaName":"ODBVUE","sxml":""}