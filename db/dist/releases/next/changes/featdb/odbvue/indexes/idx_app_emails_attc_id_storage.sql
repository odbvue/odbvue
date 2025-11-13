-- liquibase formatted sql
-- changeset ODBVUE:1763034962287 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_emails_attc_id_storage.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_emails_attc_id_storage.sql:null:275d4c5c149d1e7893a3b5543ca5afef0401df38:create

CREATE INDEX odbvue.idx_app_emails_attc_id_storage ON
    odbvue.app_emails_attc (
        id_storage
    );

