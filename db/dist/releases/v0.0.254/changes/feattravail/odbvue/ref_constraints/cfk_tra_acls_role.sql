-- liquibase formatted sql
-- changeset ODBVUE:1766496653798 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_acls_role.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_acls_role.sql:null:77774094353a041ccc118a7a6938ddabd8d5e995:create

ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cfk_tra_acls_role
        FOREIGN KEY ( role )
            REFERENCES odbvue.app_roles ( role )
                ON DELETE CASCADE
        ENABLE;

