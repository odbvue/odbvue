-- liquibase formatted sql
-- changeset ODBVUE:1768042839019 stripComments:false  logicalFilePath:featchore\odbvue\indexes\idx_crm_persons_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_persons_created.sql:null:9dde60f592f10a6cb83d91a6e4a033480a8d62e9:create

CREATE INDEX odbvue.idx_crm_persons_created ON
    odbvue.crm_persons (
        created
    );

