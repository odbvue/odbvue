-- liquibase formatted sql
-- changeset ODBVUE:1765288871994 stripComments:false  logicalFilePath:feattravail\odbvue\tables\tra_plans.sql
-- sqlcl_snapshot db/src/database/odbvue/tables/tra_plans.sql:86ace6164cd17f1189472906a325bc68d24443aa:5141647c949e22319cc549b9db659acc307e4743:alter

ALTER TABLE odbvue.tra_plans ADD (
    units VARCHAR2(30 CHAR)
);

