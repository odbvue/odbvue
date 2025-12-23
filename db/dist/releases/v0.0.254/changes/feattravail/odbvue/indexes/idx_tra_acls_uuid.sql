-- liquibase formatted sql
-- changeset ODBVUE:1766496653686 stripComments:false  logicalFilePath:feattravail\odbvue\indexes\idx_tra_acls_uuid.sql
-- sqlcl_snapshot db/src/database/odbvue/indexes/idx_tra_acls_uuid.sql:null:5035f852e86f9c176222e8f11fd8fb255fb8f7a8:create

CREATE INDEX odbvue.idx_tra_acls_uuid ON
    odbvue.tra_acls (
        uuid
    );

