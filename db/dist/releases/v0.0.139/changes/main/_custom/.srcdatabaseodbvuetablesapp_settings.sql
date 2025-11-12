-- liquibase formatted sql
-- changeset  SqlCl:1762984262380 stripComments:false logicalFilePath:main\_custom\.srcdatabaseodbvuetablesapp_settings.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\.srcdatabaseodbvuetablesapp_settings.sql:null:null:custom


CREATE TABLE odbvue.app_settings (
    id      VARCHAR2(30 CHAR) NOT NULL ENABLE,
    name    VARCHAR2(200 CHAR) NOT NULL ENABLE,
    value   VARCHAR2(2000 CHAR),
    options CLOB
);

ALTER TABLE odbvue.app_settings ADD CONSTRAINT chk_app_settings_options CHECK ( options IS JSON ) ENABLE;

ALTER TABLE odbvue.app_settings
    ADD CONSTRAINT cpk_app_settings PRIMARY KEY ( id )
        USING INDEX ENABLE;

