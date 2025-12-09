-- liquibase formatted sql
-- changeset ODBVUE:1765288870567 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_links_child.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_links_child.sql:null:73dbe4d44e67e8fa3038296bafc3db900dc94895:create

ALTER TABLE odbvue.tra_links
    ADD CONSTRAINT cfk_tra_links_child
        FOREIGN KEY ( child_id )
            REFERENCES odbvue.tra_tasks ( id )
                ON DELETE CASCADE
        ENABLE;

