-- liquibase formatted sql
-- changeset ODBVUE:1763119014167 stripComments:false  logicalFilePath:featdb\odbvue\tables\app_permissions.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/app_permissions.sql:null:3b24daf4d048ffb3ca997a97bad0f53681be64b4:create

CREATE TABLE odbvue.app_permissions (
    id_user    NUMBER(19, 0) NOT NULL ENABLE,
    id_role    NUMBER(19, 0) NOT NULL ENABLE,
    permission VARCHAR2(2000 CHAR) NOT NULL ENABLE,
    valid_from TIMESTAMP(6) DEFAULT systimestamp NOT NULL ENABLE,
    valid_to   TIMESTAMP(6)
);

ALTER TABLE odbvue.app_permissions
    ADD CONSTRAINT cpk_app_permissions PRIMARY KEY ( id_user,
                                                     id_role )
        USING INDEX ENABLE;

