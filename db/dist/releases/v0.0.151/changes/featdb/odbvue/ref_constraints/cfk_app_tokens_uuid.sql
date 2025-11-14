-- liquibase formatted sql
-- changeset ODBVUE:1763119014102 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_tokens_uuid.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_tokens_uuid.sql:null:5ac6ee05c6ec133dab5895d514047670b21300f5:create

ALTER TABLE odbvue.app_tokens
    ADD CONSTRAINT cfk_app_tokens_uuid
        FOREIGN KEY ( uuid )
            REFERENCES odbvue.app_users ( uuid )
        ENABLE;

