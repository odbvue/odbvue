-- liquibase formatted sql
-- changeset ODBVUE:1764153051716 stripComments:false  logicalFilePath:featadmin\odbvue\package_specs\pck_adm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_adm.sql:null:5ff71cd6cced4eaf6e4db1ddd1d211df4eaf663d:create

CREATE OR REPLACE PACKAGE odbvue.pck_adm AS
    PROCEDURE get_audit (
        p_search VARCHAR2 DEFAULT NULL,
        p_limit  PLS_INTEGER DEFAULT 10,
        p_offset PLS_INTEGER DEFAULT 0,
        r_audit  OUT SYS_REFCURSOR
    );

END pck_adm;
/

