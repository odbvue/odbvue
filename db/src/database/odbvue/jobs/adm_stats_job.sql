BEGIN
    dbms_scheduler.create_job(
        job_name      => '"ODBVUE"."ADM_STATS_JOB"',
        program_name  => '"ODBVUE"."ADM_STATS_PROGRAM"',
        job_style     => 'REGULAR',
        schedule_name => '"ODBVUE"."ADM_STATS_SCHEDULE"',
        job_class     => 'DEFAULT_JOB_CLASS',
        comments      => 'Job refreshes application statistics',
        auto_drop     => TRUE
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."ADM_STATS_JOB"',
        attribute => 'logging_level',
        value     => dbms_scheduler.logging_off
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."ADM_STATS_JOB"',
        attribute => 'job_priority',
        value     => 3
    );

    dbms_scheduler.enable('"ODBVUE"."ADM_STATS_JOB"');
END;
/


-- sqlcl_snapshot {"hash":"94ea91d19ec517252a262f97581418983e6ab580","type":"JOB","name":"ADM_STATS_JOB","schemaName":"ODBVUE","sxml":""}