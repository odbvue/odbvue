-- liquibase formatted sql
-- changeset ODBVUE:1765374632025 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_notes_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_notes_created.sql:null:8f46803a457e45f2961ba3eb741f5d5cf3145bd1:create

CREATE INDEX odbvue.idx_tra_notes_created ON
    odbvue.tra_notes (
        created
    );

