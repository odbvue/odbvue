-- liquibase formatted sql
-- changeset odbvue:1762857937922 stripComments:false  logicalFilePath:featdb\odbvue\comments\app_labels.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/app_labels.sql:null:322db705eeab8119ef1ed3e74879af4bb0bb6037:create

COMMENT ON TABLE odbvue.app_labels IS
    'Table for storing app_labels';

COMMENT ON COLUMN odbvue.app_labels.code IS
    'Label code (uppercase, spaces replaced with underscores)';

COMMENT ON COLUMN odbvue.app_labels.name IS
    'Label name';

