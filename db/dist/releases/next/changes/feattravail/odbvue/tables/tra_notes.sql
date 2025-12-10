-- liquibase formatted sql
-- changeset ODBVUE:1765374634738 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_notes.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_notes.sql:5025e020e7bf0392b9e420743a3566306ac2b1f1:ba653223af51bd38ed95a6379b6f346013e83635:alter

ALTER TABLE odbvue.tra_notes ADD (
    assistant  CLOB,
    editor     CHAR(32 CHAR),
    modified   TIMESTAMP(6),
    storage_id CHAR(32 CHAR)
);

