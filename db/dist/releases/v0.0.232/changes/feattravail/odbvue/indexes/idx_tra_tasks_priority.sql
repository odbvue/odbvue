-- liquibase formatted sql
-- changeset ODBVUE:1765288870328 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_priority.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_priority.sql:null:be38dca6f8936f25f0d91543bfcba8c1e8f8d70f:create

CREATE INDEX odbvue.idx_tra_tasks_priority ON
    odbvue.tra_tasks (
        priority
    );

