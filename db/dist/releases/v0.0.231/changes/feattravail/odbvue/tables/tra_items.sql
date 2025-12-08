-- liquibase formatted sql
-- changeset ODBVUE:1765201658797 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_items.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_items.sql:null:b47c5c0bc092ba082a45df7f69b6e9ed8f9471d7:create

CREATE TABLE odbvue.tra_items (
    task_id NUMBER(19, 0) NOT NULL ENABLE,
    key     VARCHAR2(100 CHAR) NOT NULL ENABLE,
    type    VARCHAR2(50 CHAR) NOT NULL ENABLE,
    value   CLOB
);

