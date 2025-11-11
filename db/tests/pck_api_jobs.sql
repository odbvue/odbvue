BEGIN
    pck_api_jobs.add('test','pck_api_audit.info', '[{"type":"VARCHAR2", "name": "p_message", "value":"Test job"}]', 'FREQ=WEEKLY; BYDAY=MON; BYHOUR=0; BYMINUTE=0; BYSECOND=0', 'Weekly Test Job');
    pck_api_jobs.run('test');
    pck_api_jobs.remove('test');
END;
/

SELECT *
FROM user_scheduler_job_run_details
WHERE job_name = 'TEST_JOB'
ORDER BY log_date DESC
FETCH FIRST 10 ROWS ONLY;