-- liquibase formatted sql
-- changeset ODBVUE:1765288872127 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_tasks.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_tasks.sql:ae2033aca802dac5e3e4fc8fdc4d453721e6a782:ec43e8901738b3a00e20dad8df322f07f2722759:alter

ALTER TABLE odbvue.tra_tasks ADD (
    completed TIMESTAMP(6),
    editor    CHAR(32 CHAR),
    estimated NUMBER(19, 0) DEFAULT 0 NOT NULL ENABLE,
    invested  NUMBER(19, 0) DEFAULT 0 NOT NULL ENABLE,
    remaining NUMBER(19, 0) DEFAULT 0 NOT NULL ENABLE,
    reminder  TIMESTAMP(6),
    started   TIMESTAMP(6)
);

ALTER TABLE odbvue.tra_tasks MODIFY (
    author CHAR(32 CHAR) NOT NULL ENABLE,
    key VARCHAR2(30 CHAR) NOT NULL ENABLE,
    status VARCHAR2(30 CHAR)
);

