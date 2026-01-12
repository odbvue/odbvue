-- liquibase formatted sql
-- changeset ODBVUE:1768224851391 stripComments:false  logicalFilePath:featcrm-products\odbvue\indexes\idx_crm_products_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_products_created.sql:null:d617000f5aaf1c0c59e7008f0aa9ea4702c31eba:create

CREATE INDEX odbvue.idx_crm_products_created ON
    odbvue.crm_products (
        created
    );

