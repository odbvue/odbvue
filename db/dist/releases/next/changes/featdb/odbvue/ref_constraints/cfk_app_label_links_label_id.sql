-- liquibase formatted sql
-- changeset ODBVUE:1762857938453 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_label_links_label_id.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_label_links_label_id.sql:null:5d698e7231cafb9613c710296ad99ed2a27f313a:create

ALTER TABLE odbvue.app_label_links
    ADD CONSTRAINT cfk_app_label_links_label_id
        FOREIGN KEY ( label_id )
            REFERENCES odbvue.app_labels ( id )
                ON DELETE CASCADE
        ENABLE;

