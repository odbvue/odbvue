-- liquibase formatted sql
-- changeset ODBVUE:1762857938526 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_label_links.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_label_links.sql:null:b0fc8197f79a4bb2472127a10138597c4d740489:create

CREATE TABLE odbvue.app_label_links (
    label_id     NUMBER NOT NULL ENABLE,
    entity_name  VARCHAR2(100 CHAR) NOT NULL ENABLE,
    entity_id_nm NUMBER,
    entity_id_vc VARCHAR2(2000 CHAR)
)
    PARTITION BY HASH ( entity_name ) ( PARTITION sys_p3447,
    PARTITION sys_p3448,
    PARTITION sys_p3449,
    PARTITION sys_p3450,
    PARTITION sys_p3451,
    PARTITION sys_p3452,
    PARTITION sys_p3453,
    PARTITION sys_p3454,
    PARTITION sys_p3455,
    PARTITION sys_p3456,
    PARTITION sys_p3457,
    PARTITION sys_p3458,
    PARTITION sys_p3459,
    PARTITION sys_p3460,
    PARTITION sys_p3461,
    PARTITION sys_p3462 );

ALTER TABLE odbvue.app_label_links
    ADD CONSTRAINT chk_app_label_links
        CHECK ( ( entity_id_nm IS NOT NULL
                  AND entity_id_vc IS NULL )
                OR ( entity_id_nm IS NULL
                     AND entity_id_vc IS NOT NULL ) ) ENABLE;

ALTER TABLE odbvue.app_label_links
    ADD CONSTRAINT chk_app_label_links_entity_name
        CHECK ( entity_name = upper(replace(entity_name, ' ', '_')) ) ENABLE;

ALTER TABLE odbvue.app_label_links
    ADD CONSTRAINT chk_app_label_links_nm
        CHECK ( entity_id_nm IS NULL
                OR entity_id_nm > 0 ) ENABLE;

