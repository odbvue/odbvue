-- liquibase formatted sql
-- changeset ODBVUE:1765288870793 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_labels.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_labels.sql:null:61cf16763e2184cdd520830945db672fbdc75cc3:create

CREATE TABLE odbvue.tra_labels (
    value VARCHAR2(30 CHAR),
    title VARCHAR2(100 CHAR) NOT NULL ENABLE,
    attrs CLOB
);

ALTER TABLE odbvue.tra_labels ADD PRIMARY KEY ( value )
    USING INDEX ENABLE;

