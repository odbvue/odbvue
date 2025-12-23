-- liquibase formatted sql
-- changeset ODBVUE:1766485130253 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_archived.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_archived.sql:null:cc0ab32f1aa2b47307b58b2a20c2e3a7fc1545ca:create

CREATE INDEX odbvue.idx_tra_tasks_archived ON
    odbvue.tra_tasks (
        archived
    );

