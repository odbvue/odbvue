-- liquibase formatted sql
-- changeset ODBVUE:1765288870506 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_status.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_status.sql:null:232ffbe8df2cafa7fc0a185899e6ffef8de10294:create

CREATE INDEX odbvue.idx_tra_tasks_status ON
    odbvue.tra_tasks (
        status
    );

