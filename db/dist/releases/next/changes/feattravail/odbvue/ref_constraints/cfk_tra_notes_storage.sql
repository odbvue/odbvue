-- liquibase formatted sql
-- changeset ODBVUE:1765374632573 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_notes_storage.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_notes_storage.sql:null:8e87d2e1868305cff84ba20c57976f1cfa4f7cca:create

ALTER TABLE odbvue.tra_notes
    ADD CONSTRAINT cfk_tra_notes_storage
        FOREIGN KEY ( storage_id )
            REFERENCES odbvue.app_storage ( id )
        ENABLE;

