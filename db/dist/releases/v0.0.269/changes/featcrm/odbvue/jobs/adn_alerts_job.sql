-- liquibase formatted sql
-- changeset ODBVUE:1768206720055 stripComments:false  logicalFilePath:featcrm\odbvue\jobs\adn_alerts_job.sql
-- sqlcl_snapshot db/src/database/odbvue/jobs/adn_alerts_job.sql:aba899e5ed4adef14abe4cf670fafc9cb760d3b5:869de65ea7080c8799ccd06da88b9c5e83425522:alter

BEGIN
    dbms_scheduler.disable('"ODBVUE"."ADN_ALERTS_SCHEDULE"');
END;
/

