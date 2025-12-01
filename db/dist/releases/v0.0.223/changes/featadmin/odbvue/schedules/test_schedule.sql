-- liquibase formatted sql
-- changeset ODBVUE:1764593433888 stripComments:false  logicalFilePath:featadmin\odbvue\schedules\test_schedule.sql
-- sqlcl_snapshot db/src/database/odbvue/schedules/test_schedule.sql:0d2d394ed9ef374937531f7d43dfc4f90faf5033:166296d15b7f1fc568abcad97f8ade9cb37a3308:alter

BEGIN
    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TEST_SCHEDULE"',
        attribute => 'start_date',
        value     => TIMESTAMP '2025-12-01 14:38:49.411676'
    );
END;
/

