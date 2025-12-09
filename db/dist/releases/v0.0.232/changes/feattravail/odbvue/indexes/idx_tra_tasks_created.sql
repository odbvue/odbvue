-- liquibase formatted sql
-- changeset ODBVUE:1765288870046 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_created.sql:null:b0b00b040ab8fd8993cc9ef6ab474c8d3200ef02:create

CREATE INDEX odbvue.idx_tra_tasks_created ON
    odbvue.tra_tasks (
        created
    );

