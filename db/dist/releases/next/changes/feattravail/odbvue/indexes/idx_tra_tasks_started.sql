-- liquibase formatted sql
-- changeset ODBVUE:1765288870448 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_started.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_started.sql:null:0145101ad3aec382b00d86905bba7c2848e29c03:create

CREATE INDEX odbvue.idx_tra_tasks_started ON
    odbvue.tra_tasks (
        started
    );

