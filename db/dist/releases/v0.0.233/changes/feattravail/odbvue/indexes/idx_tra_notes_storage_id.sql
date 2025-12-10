-- liquibase formatted sql
-- changeset ODBVUE:1765374632148 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_notes_storage_id.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_notes_storage_id.sql:null:875b136550c72dcc76e76ff9f6173cd253e54d43:create

CREATE INDEX odbvue.idx_tra_notes_storage_id ON
    odbvue.tra_notes (
        storage_id
    );

