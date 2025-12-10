-- liquibase formatted sql
-- changeset ODBVUE:1765374632662 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_notes_task.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_notes_task.sql:null:bb96d1d3910126f25ad1414992b3304b509caf45:create

ALTER TABLE odbvue.tra_notes
    ADD CONSTRAINT cfk_tra_notes_task
        FOREIGN KEY ( task_id )
            REFERENCES odbvue.tra_tasks ( id )
        ENABLE;

