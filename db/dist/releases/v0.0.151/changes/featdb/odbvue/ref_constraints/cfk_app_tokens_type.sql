-- liquibase formatted sql
-- changeset ODBVUE:1763119014051 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_tokens_type.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_tokens_type.sql:null:a410b8c0222fd5408c0ab3372e8e4efb0c2a969e:create

ALTER TABLE odbvue.app_tokens
    ADD CONSTRAINT cfk_app_tokens_type
        FOREIGN KEY ( type_id )
            REFERENCES odbvue.app_token_types ( id )
        ENABLE;

