-- liquibase formatted sql
-- changeset ODBVUE:1763034962867 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_emails.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_emails.sql:null:ce5adc51f44f917afdfb9dff5360a70d4a279eb1:create

CREATE TABLE odbvue.app_emails (
    id        CHAR(32 CHAR) DEFAULT lower(sys_guid()) NOT NULL ENABLE,
    subject   VARCHAR2(240 CHAR) NOT NULL ENABLE,
    content   CLOB,
    priority  NUMBER(1, 0) DEFAULT 3 NOT NULL ENABLE,
    status    CHAR(1 CHAR) DEFAULT 'N' NOT NULL ENABLE,
    created   TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    delivered TIMESTAMP(6),
    attempts  NUMBER(10, 0) DEFAULT 0 NOT NULL ENABLE,
    postponed TIMESTAMP(6),
    error     VARCHAR2(2000 CHAR)
)
        PARTITION BY LIST ( status ) ( PARTITION emails_active VALUES ( 'N' ),
            PARTITION emails_archive VALUES ( 'S',
                                              'E' )
        )
    ENABLE ROW MOVEMENT;

ALTER TABLE odbvue.app_emails
    ADD CONSTRAINT cpk_app_emails PRIMARY KEY ( id )
        USING INDEX ENABLE;

ALTER TABLE odbvue.app_emails
    ADD CONSTRAINT csc_app_emails_status
        CHECK ( status IN ( 'N', 'S', 'E' ) ) ENABLE;

