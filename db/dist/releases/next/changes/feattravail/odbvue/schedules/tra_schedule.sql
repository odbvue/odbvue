-- liquibase formatted sql
-- changeset ODBVUE:1765374632782 stripComments:false  logicalFilePath:feattravail\odbvue\schedules\tra_schedule.sql
-- sqlcl_snapshot db/src/database/odbvue/schedules/tra_schedule.sql:null:200107843ea6a320fa98e82ffa4f39d3679c12b8:create

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

