-- liquibase formatted sql
-- changeset ODBVUE:1764165348300 stripComments:false  logicalFilePath:featadmin\odbvue\package_specs\pck_adm.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_adm.sql:5ff71cd6cced4eaf6e4db1ddd1d211df4eaf663d:82a4dc2b7e9c7f66f9a1dfb73d915191ab6fecb2:alter

CREATE OR REPLACE PACKAGE odbvue.pck_adm AS -- Administration package

    PROCEDURE get_audit ( -- Get audit logs with filtering and pagination
        p_filter VARCHAR2 DEFAULT NULL, -- filters (as UrlEncoded JSON)
        p_limit  PLS_INTEGER DEFAULT 10, -- number of records to return
        p_offset PLS_INTEGER DEFAULT 0, -- offset for pagination
        r_audit  OUT SYS_REFCURSOR -- ref cursor for audit records [{id, created, username, severity, message, attributes}]
    );

END pck_adm;
/

