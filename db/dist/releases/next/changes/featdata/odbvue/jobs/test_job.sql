-- liquibase formatted sql
-- changeset ODBVUE:1764509622554 stripComments:false  logicalFilePath:featdata\odbvue\jobs\test_job.sql
-- sqlcl_snapshot db/src/database/odbvue/jobs/test_job.sql:null:7ff145b8106bd5dc301abbae7ffb46b2aa780358:create

BEGIN
    dbms_scheduler.create_job(
        job_name      => '"ODBVUE"."TEST_JOB"',
        program_name  => '"ODBVUE"."TEST_PROGRAM"',
        job_style     => 'REGULAR',
        schedule_name => '"ODBVUE"."TEST_SCHEDULE"',
        job_class     => 'DEFAULT_JOB_CLASS',
        comments      => 'Weekly Test Job',
        auto_drop     => TRUE
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TEST_JOB"',
        attribute => 'logging_level',
        value     => dbms_scheduler.logging_off
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."TEST_JOB"',
        attribute => 'job_priority',
        value     => 3
    );

    dbms_scheduler.enable('"ODBVUE"."TEST_JOB"');
END;
/

