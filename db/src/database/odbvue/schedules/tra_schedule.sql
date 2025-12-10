BEGIN
    dbms_scheduler.create_schedule(
        schedule_name   => '"ODBVUE"."TRA_SCHEDULE"',
        start_date      => TIMESTAMP '2025-12-10 14:58:51.093194',
        end_date        => NULL,
        repeat_interval => 'FREQ=MINUTELY',
        comments        => NULL
    );
END;
/


-- sqlcl_snapshot {"hash":"200107843ea6a320fa98e82ffa4f39d3679c12b8","type":"SCHEDULE","name":"TRA_SCHEDULE","schemaName":"ODBVUE","sxml":""}