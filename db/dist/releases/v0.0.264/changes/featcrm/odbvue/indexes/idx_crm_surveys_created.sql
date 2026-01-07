-- liquibase formatted sql
-- changeset ODBVUE:1767794234224 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_surveys_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_surveys_created.sql:null:781d017f4351e9b7ca38ff51924310a73902a359:create

CREATE INDEX odbvue.idx_crm_surveys_created ON
    odbvue.crm_surveys (
        created
    );

