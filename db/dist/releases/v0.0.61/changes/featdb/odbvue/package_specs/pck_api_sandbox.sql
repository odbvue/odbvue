-- liquibase formatted sql
-- changeset ODBVUE:1762070696082 stripComments:false  logicalFilePath:featdb\odbvue\package_specs\pck_api_sandbox.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_sandbox.sql:null:4dcbfec699879c5beef52cadd1c0b114bb98edbf:create

create or replace package odbvue.pck_api_sandbox as -- Package for experiments

    procedure whoami; -- Procedure outputs current user and edition info
end pck_api_sandbox;
/

