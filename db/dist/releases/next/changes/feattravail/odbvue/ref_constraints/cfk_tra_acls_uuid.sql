-- liquibase formatted sql
-- changeset ODBVUE:1766496653852 stripComments:false  logicalFilePath:feattravail\odbvue\ref_constraints\cfk_tra_acls_uuid.sql
-- sqlcl_snapshot db/src/database/odbvue/ref_constraints/cfk_tra_acls_uuid.sql:null:be680c124e43e22f2ddd4297453b6c182f13ba83:create

ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cfk_tra_acls_uuid
        FOREIGN KEY ( uuid )
            REFERENCES odbvue.app_users ( uuid )
                ON DELETE CASCADE
        ENABLE;

