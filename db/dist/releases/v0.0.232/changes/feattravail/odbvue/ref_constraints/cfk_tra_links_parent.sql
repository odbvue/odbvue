-- liquibase formatted sql
-- changeset ODBVUE:1765288870628 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_links_parent.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_links_parent.sql:null:363969dc172874cc654c3566aa4d3ab9d1337929:create

ALTER TABLE odbvue.tra_links
    ADD CONSTRAINT cfk_tra_links_parent
        FOREIGN KEY ( parent_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;

