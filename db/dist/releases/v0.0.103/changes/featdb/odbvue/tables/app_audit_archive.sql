-- liquibase formatted sql
-- changeset ODBVUE:1762783026762 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_audit_archive.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_audit_archive.sql:null:ba42d0b1691ac86f1af2af119ac5ac9725ec7c2f:create

CREATE TABLE odbvue.app_audit_archive (
    id         CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    severity   VARCHAR2(30 CHAR) DEFAULT 'INFO' NOT NULL ENABLE,
    message    VARCHAR2(2000 CHAR) NOT NULL ENABLE,
    attributes CLOB,
    created    TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    uuid       VARCHAR2(32 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.uuid' RETURNING VARCHAR2(32) NULL ON ERROR
    ) ) VIRTUAL,
    module     VARCHAR2(200 CHAR) GENERATED ALWAYS AS ( JSON_VALUE(attributes FORMAT JSON, '$.module_name' RETURNING VARCHAR2(200) NULL
    ON ERROR) ) VIRTUAL
)
    PARTITION BY RANGE (
        created
    ) INTERVAL ( numtoyminterval(1, 'MONTH') ) ( PARTITION p_start
        VALUES LESS THAN ( TIMESTAMP ' 2025-01-01 00:00:00' )
    );

ALTER TABLE odbvue.app_audit_archive ADD CONSTRAINT chk_app_audit_archive_attributes CHECK ( attributes IS JSON ) ENABLE;

ALTER TABLE odbvue.app_audit_archive
    ADD CONSTRAINT chk_app_audit_archive_severity
        CHECK ( severity IN ( 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL' ) ) ENABLE;

ALTER TABLE odbvue.app_audit_archive
    ADD CONSTRAINT cpk_app_audit_archive PRIMARY KEY ( id )
        USING INDEX ENABLE;

