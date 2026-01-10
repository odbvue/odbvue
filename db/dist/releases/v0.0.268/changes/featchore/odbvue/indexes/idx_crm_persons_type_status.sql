-- liquibase formatted sql
-- changeset ODBVUE:1768042839216 stripComments:false  logicalFilePath:featchore\odbvue\indexes\idx_crm_persons_type_status.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_persons_type_status.sql:null:96078361fcf082e51525b47ae5b96e9677bc63ab:create

CREATE INDEX odbvue.idx_crm_persons_type_status ON
    odbvue.crm_persons (
        type,
        status
    );

