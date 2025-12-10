-- liquibase formatted sql
-- changeset ODBVUE:1765374632258 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_notes_task_id.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_notes_task_id.sql:null:aacd7e4df4eaf5034be25fda5835a96197dc52d3:create

CREATE INDEX odbvue.idx_tra_notes_task_id ON
    odbvue.tra_notes (
        task_id
    );

