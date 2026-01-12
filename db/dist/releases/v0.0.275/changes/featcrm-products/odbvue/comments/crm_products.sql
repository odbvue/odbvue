-- liquibase formatted sql
-- changeset odbvue:1768224851307 stripComments:false  logicalFilePath:featcrm-products\odbvue\comments\crm_products.sql
-- sqlcl_snapshot db/src/database/odbvue/comments/crm_products.sql:null:5c179056ecee7ac2e0064be43f03179cadf2c34f:create

COMMENT ON TABLE odbvue.crm_products IS
    'CRM Products Table';

COMMENT ON COLUMN odbvue.crm_products.code IS
    'Product code';

COMMENT ON COLUMN odbvue.crm_products.created IS
    'Creation timestamp';

COMMENT ON COLUMN odbvue.crm_products.description IS
    'Product description';

COMMENT ON COLUMN odbvue.crm_products.guid IS
    'Global Unique Identifier';

COMMENT ON COLUMN odbvue.crm_products.id IS
    'Primary key';

COMMENT ON COLUMN odbvue.crm_products.modified IS
    'Last modification timestamp';

COMMENT ON COLUMN odbvue.crm_products.name IS
    'Product name';

COMMENT ON COLUMN odbvue.crm_products.price IS
    'Product price';

COMMENT ON COLUMN odbvue.crm_products.status IS
    'Status (A = Active, I = Inactive)';

