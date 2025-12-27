-- liquibase formatted sql
-- changeset ODBVUE:1766851593574 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_type.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_type.sql:null:a2a84cdc76cb8fbccefaf48769a2e70a39fabdf9:create

CREATE INDEX odbvue.idx_tra_tasks_type ON
    odbvue.tra_tasks (
        type
    );

