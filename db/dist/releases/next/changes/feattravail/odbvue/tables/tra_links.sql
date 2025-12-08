-- liquibase formatted sql
-- changeset ODBVUE:1765201658863 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_links.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_links.sql:null:ef47498c3863c6da6cf1d4529c7e5520181f1910:create

CREATE TABLE odbvue.tra_links (
    parent_id NUMBER(19, 0) NOT NULL ENABLE,
    child_id  NUMBER(19, 0) NOT NULL ENABLE
);

