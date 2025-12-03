-- liquibase formatted sql
-- changeset  SqlCl:1764757800707 stripComments:false logicalFilePath:featchore\_custom\010_job_adm_alerts_typo.sql
-- sqlcl_snapshot dist\releases\next\changes\featchore\_custom\010_job_adm_alerts_typo.sql:null:null:custom

begin 
    pck_api_jobs.remove('ADN_ALERTS');
    pck_api_jobs.remove('ADM_ALERTS');
    --pck_api_jobs.add('adm_alerts','pck_adm.job_alerts',NULL,'FREQ=MINUTELY; INTERVAL=15','Refresh Admin Dashboard Alerts');
end;    
/
