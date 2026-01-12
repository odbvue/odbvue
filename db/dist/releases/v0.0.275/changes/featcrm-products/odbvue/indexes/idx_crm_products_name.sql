-- liquibase formatted sql
-- changeset ODBVUE:1768224851508 stripComments:false  logicalFilePath:featcrm-products\odbvue\indexes\idx_crm_products_name.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_products_name.sql:null:79b82891bb3137ee73161d94308d4d1136b68d2b:create

CREATE INDEX odbvue.idx_crm_products_name ON
    odbvue.crm_products (
        name
    );

