-- liquibase formatted sql
-- changeset ODBVUE:1768206719535 stripComments:false  logicalFilePath:featcrm\odbvue\indexes\idx_crm_persons_phone.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_persons_phone.sql:null:56d072c8e7dc8c8532aeec6fcdc17324c820bf78:create

CREATE INDEX odbvue.idx_crm_persons_phone ON
    odbvue.crm_persons (
        phone
    );

