-- liquibase formatted sql
-- changeset ODBVUE:1766496653916 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_acls.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_acls.sql:null:b4ac3542573e4c7db693b05a68e0ce9af2ebb393:create

CREATE TABLE odbvue.tra_acls (
    board VARCHAR2(32 CHAR) NOT NULL ENABLE,
    role  VARCHAR2(32 CHAR) NOT NULL ENABLE
);

ALTER TABLE odbvue.tra_acls
    ADD CONSTRAINT cpk_tra_acls PRIMARY KEY ( board,
                                              role )
        USING INDEX ENABLE;

