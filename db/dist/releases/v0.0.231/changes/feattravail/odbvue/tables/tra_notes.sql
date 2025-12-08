-- liquibase formatted sql
-- changeset ODBVUE:1765201658927 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_notes.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_notes.sql:null:86d3cbb7f7c07f33d4d504503e96614e204cf8b2:create

CREATE TABLE odbvue.tra_notes (
    id      NUMBER(19, 0) GENERATED ALWAYS AS IDENTITY NOT NULL ENABLE,
    task_id NUMBER(19, 0) NOT NULL ENABLE,
    author  CHAR(32 CHAR),
    content CLOB,
    created TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE
);

ALTER TABLE odbvue.tra_notes ADD PRIMARY KEY ( id )
    USING INDEX ENABLE;

