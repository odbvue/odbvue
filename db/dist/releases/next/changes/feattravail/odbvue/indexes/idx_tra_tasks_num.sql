-- liquibase formatted sql
-- changeset ODBVUE:1765288870260 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_tasks_num.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_tasks_num.sql:null:9e2632177bdbee6c57a7be75cfdc0a0ac7c65c4d:create

CREATE INDEX odbvue.idx_tra_tasks_num ON
    odbvue.tra_tasks (
        num
    );

