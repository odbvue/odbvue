-- liquibase formatted sql
-- changeset ODBVUE:1765201659113 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_tasks.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_tasks.sql:null:83f80c15a332463fde8b9fc3d4f623d281f99e67:create

CREATE TABLE odbvue.tra_tasks (
    id          NUMBER(19, 0) GENERATED ALWAYS AS IDENTITY NOT NULL ENABLE,
    key         VARCHAR2(30 CHAR),
    title       VARCHAR2(200 CHAR) NOT NULL ENABLE,
    description CLOB,
    due         TIMESTAMP(6),
    status      VARCHAR2(30 CHAR) DEFAULT 'todo' NOT NULL ENABLE,
    priority    VARCHAR2(30 CHAR),
    author      CHAR(32 CHAR),
    assignee    CHAR(32 CHAR),
    created     TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    modified    TIMESTAMP(6),
    num         VARCHAR2(50 CHAR) GENERATED ALWAYS AS ( key
                                                || '-' || to_char(id) ) VIRTUAL
);

ALTER TABLE odbvue.tra_tasks ADD PRIMARY KEY ( id )
    USING INDEX ENABLE;

