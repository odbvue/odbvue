-- liquibase formatted sql
-- changeset ODBVUE:1764760292835 stripComments:false  logicalFilePath:featchore\odbvue\jobs\test_job.sql
-- sqlcl_snapshot db/src/database/odbvue/jobs/test_job.sql:7ff145b8106bd5dc301abbae7ffb46b2aa780358:26f5bd9be3b1d0793ace428e4dd44d456038199f:alter

BEGIN
    dbms_scheduler.disable('"ODBVUE"."TEST_SCHEDULE"');
END;
/

