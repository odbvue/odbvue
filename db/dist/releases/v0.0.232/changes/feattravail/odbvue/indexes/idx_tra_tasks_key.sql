-- liquibase formatted sql
-- changeset ODBVUE:1765288870184 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_key.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_key.sql:null:8f3b3a73f89246b981b9fc4d8a8ce91404baf614:create

CREATE INDEX odbvue.idx_tra_tasks_key ON
    odbvue.tra_tasks (
        key
    );

