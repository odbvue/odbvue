-- liquibase formatted sql
-- changeset  SqlCl:1764593263349 stripComments:false logicalFilePath:featadmin\_custom\010_fix_test_job.sql
-- sqlcl_snapshot dist\releases\next\changes\featadmin\_custom\010_fix_test_job.sql:null:null:custom


BEGIN
    pck_api_jobs.add('test','pck_api_audit.info', '[{"type":"VARCHAR2", "name": "p_message", "value":"Test job"}]', 'FREQ=WEEKLY; BYDAY=MON; BYHOUR=0; BYMINUTE=0; BYSECOND=0', 'Weekly Test Job');
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- IGNORE
END;
