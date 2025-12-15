-- liquibase formatted sql
-- changeset ODBVUE:1765805669206 stripComments:false  logicalFilePath:featlanding\odbvue\tables\crm_discovery_requests.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/crm_discovery_requests.sql:526b20fc0cab3ae1e9f62e6d6f3858b26d99b671:119dbaf8ba0cac140bddc9860b017090c42856bb:alter

ALTER TABLE odbvue.crm_discovery_requests MODIFY (
    phone VARCHAR2(200 CHAR)
);

