-- liquibase formatted sql
-- changeset ODBVUE:1762030527714 stripComments:false  logicalFilePath:featdb-sandbox\odbvue\package_bodies\pck_api_sandbox.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_sandbox.sql:null:8d3c76728775ae6d35a4af91d57e44f5f9070fe3:create

create or replace package body odbvue.pck_api_sandbox as

    procedure whoami as
    begin
        dbms_output.put_line('Current User: ' || user);
        dbms_output.put_line('Current Edition: ' || sys_context('USERENV', 'CURRENT_EDITION_NAME'));
    end whoami;

end pck_api_sandbox;
/

