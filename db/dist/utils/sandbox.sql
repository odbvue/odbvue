--

SELECT * FROM app_audit order by created DESC;

SELECT * FROM app_users order by created DESC;

SELECT * FROM app_tokens order by created DESC;

SELECT * FROM app_emails ORDER BY created DESC;

SELECT * FROM app_settings;

SELECT * FROM app_token_types;

SELECT * FROM user_scheduler_job_log;

SELECT * FROM user_objects_ae;

UPDATE app_token_types SET expiration = 90 WHERE ID = 'ACCESS';

UPDATE app_users SET username = SYS_GUID()||'@ODBVUE.COM' WHERE username = UPPER(:username);

exec prc_ordsify;
/


