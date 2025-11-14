-- liquibase formatted sql
-- changeset ODBVUE:1763119013529 stripComments:false  logicalFilePath:featdb\odbvue\indexes\idx_app_tokens_uuid.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_app_tokens_uuid.sql:null:7c6261156feb37ab31028d55ff71ab6c2f06da61:create

CREATE INDEX odbvue.idx_app_tokens_uuid ON
    odbvue.app_tokens (
        uuid
    );

