-- liquibase formatted sql
-- changeset ODBVUE:1762284803369 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_sandbox.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_sandbox.sql:4dcbfec699879c5beef52cadd1c0b114bb98edbf:477ac373a0af4a14bfe82b6fd633ddb269b768de:alter

CREATE OR REPLACE PACKAGE odbvue.pck_api_sandbox AS -- Package for experiments

    PROCEDURE whoami; -- Procedure outputs current user and edition info
END pck_api_sandbox;
/

