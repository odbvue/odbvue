-- liquibase formatted sql
-- changeset  SqlCl:1762984289065 stripComments:false logicalFilePath:main\_custom\.srcdatabaseodbvueindexesapp_settings_name.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\.srcdatabaseodbvueindexesapp_settings_name.sql:null:null:custom


CREATE INDEX odbvue.idx_app_settings_name ON
    odbvue.app_settings (
        name
    );

