BEGIN
    dbms_scheduler.create_schedule(
        schedule_name   => '"ODBVUE"."ADM_ALERTS_SCHEDULE"',
        start_date      => TIMESTAMP '2025-12-03 12:33:23.409172',
        end_date        => NULL,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=15',
        comments        => NULL
    );
END;
/


-- sqlcl_snapshot {"hash":"a65b487e77bb31ab2ef41f90e09c2378f1bee104","type":"SCHEDULE","name":"ADM_ALERTS_SCHEDULE","schemaName":"ODBVUE","sxml":""}