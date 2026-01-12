-- liquibase formatted sql
-- changeset ODBVUE:1768224851636 stripComments:false  logicalFilePath:featcrm-products\odbvue\indexes\idx_crm_products_status.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_products_status.sql:null:448ed58899005f07ea6124cd626e404da59be34f:create

CREATE INDEX odbvue.idx_crm_products_status ON
    odbvue.crm_products (
        status
    );

