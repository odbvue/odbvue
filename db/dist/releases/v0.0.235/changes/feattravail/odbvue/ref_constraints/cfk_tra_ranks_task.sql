-- liquibase formatted sql
-- changeset ODBVUE:1765536963320 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_ranks_task.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_ranks_task.sql:null:56a213daa539a9d9d9425128c0fec21704f91066:create

ALTER TABLE odbvue.tra_ranks
    ADD CONSTRAINT cfk_tra_ranks_task
        FOREIGN KEY ( task_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;

