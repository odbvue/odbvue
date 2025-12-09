-- liquibase formatted sql
-- changeset ODBVUE:1765288869830 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_assignee.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_assignee.sql:null:d5d1bbc7817b2650fedc9adc35209c77110fff85:create

CREATE INDEX odbvue.idx_tra_tasks_assignee ON
    odbvue.tra_tasks (
        assignee
    );

