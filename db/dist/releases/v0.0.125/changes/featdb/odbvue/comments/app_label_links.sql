-- liquibase formatted sql
-- changeset odbvue:1762857937868 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_label_links.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_label_links.sql:null:57142867528b515cebe4c94e3dc20e514bf14f62:create

COMMENT ON TABLE odbvue.app_label_links IS
    'Table for linking app_labels to entities';

COMMENT ON COLUMN odbvue.app_label_links.entity_id_nm IS
    'Numeric Id of the entity';

COMMENT ON COLUMN odbvue.app_label_links.entity_id_vc IS
    'Variable character Id of the entity';

COMMENT ON COLUMN odbvue.app_label_links.entity_name IS
    'Name of the entity';

COMMENT ON COLUMN odbvue.app_label_links.label_id IS
    'Id of the label';

