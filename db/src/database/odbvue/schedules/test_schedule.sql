BEGIN
    dbms_scheduler.create_schedule(
        schedule_name   => '"ODBVUE"."TEST_SCHEDULE"',
        start_date      => TIMESTAMP '2025-11-30 13:22:01.412636',
        end_date        => NULL,
        repeat_interval => 'FREQ=WEEKLY; BYDAY=MON; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
        comments        => NULL
    );
END;
/


-- sqlcl_snapshot {"hash":"0d2d394ed9ef374937531f7d43dfc4f90faf5033","type":"SCHEDULE","name":"TEST_SCHEDULE","schemaName":"ODBVUE","sxml":""}