-- liquibase formatted sql
-- changeset ODBVUE:1767794234151 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_surveys_author.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_surveys_author.sql:null:751f08e299f36f1b06a65816efa6f7d7d9c891b4:create

CREATE INDEX odbvue.idx_crm_surveys_author ON
    odbvue.crm_surveys (
        author
    );

