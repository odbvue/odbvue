-- liquibase formatted sql
-- changeset ODBVUE:1762783026641 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_audit.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_audit.sql:null:aee3a063cbf843cffb4c8804f1df0f40c6cdd0fb:create

CREATE TABLE odbvue.app_audit (
    id         CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    severity   VARCHAR2(30 CHAR) DEFAULT 'INFO' NOT NULL ENABLE,
    message    VARCHAR2(2000 CHAR) NOT NULL ENABLE,
    attributes CLOB,
    created    TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    uuid       VARCHAR2(32 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR
    ) ) VIRTUAL,
    module     VARCHAR2(200 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.module_name' RETURNING VARCHAR2(200) NULL
    ON ERROR) ) VIRTUAL
);

ALTER TABLE odbvue.app_audit ADD CONSTRAINT chk_app_audit_attributes CHECK ( attributes IS JSON ) ENABLE;

ALTER TABLE odbvue.app_audit
    ADD CONSTRAINT chk_app_audit_severity
        CHECK ( severity IN ( 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL' ) ) ENABLE;

ALTER TABLE odbvue.app_audit
    ADD CONSTRAINT cpk_app_audit PRIMARY KEY ( id )
        USING INDEX ENABLE;

