-- liquibase formatted sql
-- changeset ODBVUE:1765288870389 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_reminder.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_reminder.sql:null:c7160771ef275ce21032d4998243fc5913c85bd4:create

CREATE INDEX odbvue.idx_tra_tasks_reminder ON
    odbvue.tra_tasks (
        reminder
    );

