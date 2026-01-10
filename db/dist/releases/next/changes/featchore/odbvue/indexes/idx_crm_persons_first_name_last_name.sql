-- liquibase formatted sql
-- changeset ODBVUE:1768042839109 stripComments:false  logicalFilePath:featchore\odbvue\indexes\idx_crm_persons_first_name_last_name.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_persons_first_name_last_name.sql:null:abb340701078d1281e731d06a3954fc82df0ee76:create

CREATE INDEX odbvue.idx_crm_persons_first_name_last_name ON
    odbvue.crm_persons (
        first_name,
        last_name
    );

