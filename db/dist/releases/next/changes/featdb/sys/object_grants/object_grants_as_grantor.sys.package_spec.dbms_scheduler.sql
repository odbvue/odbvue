-- liquibase formatted sql
-- changeset SYS:1762883860751 stripComments:false  logicalFilePath:featdb\sys\object_grants\object_grants_as_grantor.sys.package_spec.dbms_scheduler.sql
-- sqlcl_snapshot db/src/database/sys/object_grants/object_grants_as_grantor.sys.package_spec.dbms_scheduler.sql:null:2792d2b6714f96f535a23f2ed7bd0c4762643e0d:create

GRANT EXECUTE ON sys.dbms_scheduler TO odbvue;

