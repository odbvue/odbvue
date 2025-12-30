-- liquibase formatted sql
-- changeset ODBVUE:1767099335096 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_work_author.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_work_author.sql:null:d4b8ddfa47ce355a2f9d2898e357b6f4a344981a:create

CREATE INDEX odbvue.idx_tra_work_author ON
    odbvue.tra_work (
        author
    );

