-- liquibase formatted sql
-- changeset ODBVUE:1764760292630 stripComments:false  logicalFilePath:featchore\odbvue\jobs\adm_alerts_job.sql
-- sqlcl_snapshot db/src/database/odbvue/jobs/adm_alerts_job.sql:null:6e7d15b92bf8bef44b1a2e39195ca83fc88fcc70:create

BEGIN
    dbms_scheduler.create_job(
        job_name      => '"ODBVUE"."ADM_ALERTS_JOB"',
        program_name  => '"ODBVUE"."ADM_ALERTS_PROGRAM"',
        job_style     => 'REGULAR',
        schedule_name => '"ODBVUE"."ADM_ALERTS_SCHEDULE"',
        job_class     => 'DEFAULT_JOB_CLASS',
        comments      => 'Refresh Admin Dashboard Alerts',
        auto_drop     => TRUE
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."ADM_ALERTS_JOB"',
        attribute => 'logging_level',
        value     => dbms_scheduler.logging_off
    );

    dbms_scheduler.set_attribute(
        name      => '"ODBVUE"."ADM_ALERTS_JOB"',
        attribute => 'job_priority',
        value     => 3
    );

    dbms_scheduler.enable('"ODBVUE"."ADM_ALERTS_JOB"');
END;
/

