BEGIN
    dbms_scheduler.create_schedule(
        schedule_name   => '"ODBVUE"."TEST_SCHEDULE"',
        start_date      => TIMESTAMP '2025-12-01 14:38:49.411676',
        end_date        => NULL,
        repeat_interval => 'FREQ=WEEKLY; BYDAY=MON; BYHOUR=0; BYMINUTE=0; BYSECOND=0',
        comments        => NULL
    );
END;
/


-- sqlcl_snapshot {"hash":"23ea0c2365d5bb06e7e6e8dcb62499a0a82113dc","type":"SCHEDULE","name":"TEST_SCHEDULE","schemaName":"ODBVUE","sxml":""}