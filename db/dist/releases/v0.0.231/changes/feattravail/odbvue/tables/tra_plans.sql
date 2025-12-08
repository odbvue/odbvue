-- liquibase formatted sql
-- changeset ODBVUE:1765201659011 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_plans.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_plans.sql:null:c9c0373ba08ea9edc3750c74e8081762315f729b:create

CREATE TABLE odbvue.tra_plans (
    id               NUMBER(19, 0) GENERATED ALWAYS AS IDENTITY NOT NULL ENABLE,
    key              VARCHAR2(30 CHAR) NOT NULL ENABLE,
    title            VARCHAR2(200 CHAR) NOT NULL ENABLE,
    description      VARCHAR2(2000 CHAR),
    due_warning_days NUMBER(5, 0) DEFAULT 7 NOT NULL ENABLE,
    statuses         CLOB,
    priorities       CLOB,
    author           CHAR(32 CHAR),
    created          TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE
);

ALTER TABLE odbvue.tra_plans ADD PRIMARY KEY ( id )
    USING INDEX ENABLE;

ALTER TABLE odbvue.tra_plans ADD UNIQUE ( key )
    USING INDEX ENABLE;

