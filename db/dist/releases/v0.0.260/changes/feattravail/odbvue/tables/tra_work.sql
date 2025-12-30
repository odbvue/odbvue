-- liquibase formatted sql
-- changeset ODBVUE:1767099335662 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_work.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_work.sql:null:3cb788fc08ba2341902075997ac9bb7413da5e69:create

CREATE TABLE odbvue.tra_work (
    id        NUMBER(19, 0) GENERATED ALWAYS AS IDENTITY NOT NULL ENABLE,
    task_id   NUMBER(19, 0) NOT NULL ENABLE,
    work_date DATE DEFAULT trunc(sysdate) NOT NULL ENABLE,
    duration  NUMBER(19, 0) DEFAULT 0 NOT NULL ENABLE,
    notes     CLOB,
    author    CHAR(32 CHAR) NOT NULL ENABLE,
    created   TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    editor    CHAR(32 CHAR),
    modified  TIMESTAMP(6)
);

ALTER TABLE odbvue.tra_work ADD PRIMARY KEY ( id )
    USING INDEX ENABLE;

