-- liquibase formatted sql
-- changeset ODBVUE:1768206719651 stripComments:false  logicalFilePath:featcrm\odbvue\package_specs\pck_api_sandbox.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_sandbox.sql:null:477ac373a0af4a14bfe82b6fd633ddb269b768de:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_sandbox AS -- Package for experiments

    PROCEDURE whoami; -- Procedure outputs current user and edition info
END pck_api_sandbox;
/

