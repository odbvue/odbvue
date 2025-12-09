-- liquibase formatted sql
-- changeset ODBVUE:1765288869972 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_completed.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_completed.sql:null:8f7eca3c16aa3cc9a61e5e8ee4108be5d9bff01e:create

CREATE INDEX odbvue.idx_tra_tasks_completed ON
    odbvue.tra_tasks (
        completed
    );

