-- liquibase formatted sql
-- changeset ODBVUE:1763119013949 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_permissions_id_role.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_permissions_id_role.sql:null:e66c295e224ce3257015f0edf25231e822864fc6:create

ALTER TABLE odbvue.app_permissions
    ADD CONSTRAINT cfk_app_permissions_id_role
        FOREIGN KEY ( id_role )
            REFERENCES odbvue.app_roles ( id )
        ENABLE;

