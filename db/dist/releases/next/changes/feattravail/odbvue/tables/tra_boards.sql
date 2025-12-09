-- liquibase formatted sql
-- changeset ODBVUE:1765288870697 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_boards.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_boards.sql:null:54e49655c5d682e580c6e844ca6dba930bd0a886:create

CREATE TABLE odbvue.tra_boards (
    key         VARCHAR2(30 CHAR),
    title       VARCHAR2(100 CHAR) NOT NULL ENABLE,
    description CLOB,
    settings    CLOB,
    author      CHAR(32 CHAR) NOT NULL ENABLE,
    created     TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    editor      CHAR(32 CHAR),
    modified    TIMESTAMP(6)
);

ALTER TABLE odbvue.tra_boards ADD CONSTRAINT chk_tra_boards_settings CHECK ( settings IS JSON ) ENABLE;

ALTER TABLE odbvue.tra_boards ADD PRIMARY KEY ( key )
    USING INDEX ENABLE;

