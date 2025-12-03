-- liquibase formatted sql
-- changeset ODBVUE:1764760292735 stripComments:false  logicalFilePath:featchore\odbvue\schedules\adm_alerts_schedule.sql
-- sqlcl_snapshot db/src/database/odbvue/schedules/adm_alerts_schedule.sql:null:a65b487e77bb31ab2ef41f90e09c2378f1bee104:create

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

