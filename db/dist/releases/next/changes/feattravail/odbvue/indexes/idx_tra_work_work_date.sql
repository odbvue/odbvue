-- liquibase formatted sql
-- changeset ODBVUE:1767099335367 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_work_work_date.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_work_work_date.sql:null:6a4bf3a2f50bd5c6a0e59e66b48b0d290744ebd3:create

CREATE INDEX odbvue.idx_tra_work_work_date ON
    odbvue.tra_work (
        work_date
    );

