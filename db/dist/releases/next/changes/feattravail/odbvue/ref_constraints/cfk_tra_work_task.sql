-- liquibase formatted sql
-- changeset ODBVUE:1767099335544 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_work_task.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_work_task.sql:null:bb9a62fed2e6632879f331a4a5e512084998241c:create

ALTER TABLE odbvue.tra_work
    ADD CONSTRAINT cfk_tra_work_task
        FOREIGN KEY ( task_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;

