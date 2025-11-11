-- liquibase formatted sql
-- changeset ODBVUE:1762857938111 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idq_app_labels_code.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idq_app_labels_code.sql:null:0d99a730c3810edaf13f1c54e120590b6051eea7:create

CREATE UNIQUE INDEX odbvue.idq_app_labels_code ON
    odbvue.app_labels (
        code
    );

