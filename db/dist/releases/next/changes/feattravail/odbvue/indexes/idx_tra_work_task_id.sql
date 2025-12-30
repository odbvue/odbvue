-- liquibase formatted sql
-- changeset ODBVUE:1767099335195 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_work_task_id.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_work_task_id.sql:null:726a1c1ad393914cc5391419dce03d617ea16a98:create

CREATE INDEX odbvue.idx_tra_work_task_id ON
    odbvue.tra_work (
        task_id
    );

