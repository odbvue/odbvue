-- liquibase formatted sql
-- changeset ODBVUE:1763119013486 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_tokens_expiration.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_tokens_expiration.sql:null:ee0c8811f095cd1428fda010d3b12acd1a8ca744:create

CREATE INDEX odbvue.idx_app_tokens_expiration ON
    odbvue.app_tokens (
        expiration
    );

