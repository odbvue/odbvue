-- liquibase formatted sql
-- changeset ODBVUE:1765288869897 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_author.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_author.sql:null:03be1dc0aa22256e5980056273d408087d834e09:create

CREATE INDEX odbvue.idx_tra_tasks_author ON
    odbvue.tra_tasks (
        author
    );

