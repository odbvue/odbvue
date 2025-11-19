-- liquibase formatted sql
-- changeset ODBVUE:1763540915736 stripComments:false  logicalFilePath:featapi\odbvue\package_specs\pck_app.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_app.sql:null:fe64d4e34da9554f2ec1382d724fb96303d641a7:create

CREATE OR REPLACE PACKAGE odbvue.pck_app AS -- Package for the main application     
    PROCEDURE get_context ( -- Returns application context
        r_version OUT VARCHAR2 -- Application version
    );

END pck_app;
/

