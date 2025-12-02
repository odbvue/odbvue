-- liquibase formatted sql
-- changeset ODBVUE:1764677783748 stripComments:false  logicalFilePath:featapp-stats\odbvue\schedules\adn_alerts_schedule.sql
-- sqlcl_snapshot db/src/database/odbvue/schedules/adn_alerts_schedule.sql:null:a97e52eee5f05b59eb4b7b4b5d08b56bc536f0b9:create

BEGIN
    dbms_scheduler.create_schedule(
        schedule_name   => '"ODBVUE"."ADN_ALERTS_SCHEDULE"',
        start_date      => TIMESTAMP '2025-12-02 13:50:14.433054',
        end_date        => NULL,
        repeat_interval => 'FREQ=MINUTELY; INTERVAL=15',
        comments        => NULL
    );
END;
/

