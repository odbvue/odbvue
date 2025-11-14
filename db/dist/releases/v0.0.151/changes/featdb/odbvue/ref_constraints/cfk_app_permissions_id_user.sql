-- liquibase formatted sql
-- changeset ODBVUE:1763119014001 stripComments:false  logicalFilePath:featdb\odbvue\ref_constraints\cfk_app_permissions_id_user.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_app_permissions_id_user.sql:null:176fb8355a88c18266ae37c387d99844767d93bc:create

ALTER TABLE odbvue.app_permissions
    ADD CONSTRAINT cfk_app_permissions_id_user
        FOREIGN KEY ( id_user )
            REFERENCES odbvue.app_users ( id )
        ENABLE;

