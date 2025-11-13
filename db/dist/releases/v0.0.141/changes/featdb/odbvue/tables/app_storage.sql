-- liquibase formatted sql
-- changeset ODBVUE:1763018047468 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_storage.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_storage.sql:null:f479608c7bacb4b76b852328de51a793850ee462:create

CREATE TABLE odbvue.app_storage (
    id         CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    file_name  VARCHAR2(2000 CHAR),
    file_size  NUMBER(19, 0),
    file_ext   VARCHAR2(30 CHAR),
    mime_type  VARCHAR2(200 CHAR),
    content    BLOB,
    created    TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    s3_uri     VARCHAR2(2000 CHAR),
    s3_created TIMESTAMP(6)
);

ALTER TABLE odbvue.app_storage
    ADD CONSTRAINT cpk_app_storage PRIMARY KEY ( id )
        USING INDEX ENABLE;

