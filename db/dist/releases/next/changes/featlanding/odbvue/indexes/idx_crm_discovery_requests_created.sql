-- liquibase formatted sql
-- changeset ODBVUE:1765800033998 stripComments:false  logicalFilePath:featlanding\odbvue\indexes\idx_crm_discovery_requests_created.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_crm_discovery_requests_created.sql:null:40c6bda210627b76d6b834b4d2e3d3adfbe23e65:create

CREATE INDEX odbvue.idx_crm_discovery_requests_created ON
    odbvue.crm_discovery_requests (
        created
    );

