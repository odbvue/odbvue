-- liquibase formatted sql
-- changeset ODBVUE:1765288870111 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_due.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_due.sql:null:b1c256816919320e024ccc0c4c3dc518ac0154f2:create

CREATE INDEX odbvue.idx_tra_tasks_due ON
    odbvue.tra_tasks (
        due
    );

