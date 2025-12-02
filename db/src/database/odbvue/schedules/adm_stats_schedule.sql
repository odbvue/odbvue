BEGIN
    dbms_scheduler.create_schedule(
        schedule_name   => '"ODBVUE"."ADM_STATS_SCHEDULE"',
        start_date      => TIMESTAMP '2025-12-02 12:08:14.485253',
        end_date        => NULL,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=15',
        comments        => NULL
    );
END;
/


-- sqlcl_snapshot {"hash":"5d7df2b7ece6bbb466d87df432a8862c61955057","type":"SCHEDULE","name":"ADM_STATS_SCHEDULE","schemaName":"ODBVUE","sxml":""}