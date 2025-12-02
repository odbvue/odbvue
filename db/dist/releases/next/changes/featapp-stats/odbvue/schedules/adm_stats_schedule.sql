-- liquibase formatted sql
-- changeset ODBVUE:1764677783680 stripComments:false  logicalFilePath:featapp-stats\odbvue\schedules\adm_stats_schedule.sql
-- sqlcl_snapshot db/src/database/odbvue/schedules/adm_stats_schedule.sql:null:5d7df2b7ece6bbb466d87df432a8862c61955057:create

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

