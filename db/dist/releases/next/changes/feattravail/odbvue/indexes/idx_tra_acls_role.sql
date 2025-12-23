-- liquibase formatted sql
-- changeset ODBVUE:1766496653619 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_acls_role.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_acls_role.sql:null:3fe3e8dff5f3602795c8b92483d1738e1bf997cf:create

CREATE INDEX odbvue.idx_tra_acls_role ON
    odbvue.tra_acls (
        role
    );

