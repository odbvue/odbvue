-- liquibase formatted sql
-- changeset ODBVUE:1763540915699 stripComments:false  logicalFilePath:featapi\odbvue\package_bodies\pck_app.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_app.sql:null:e4725e49c20d43aac075cb2174a069e80b700c03:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_app AS

    g_version VARCHAR2(30 CHAR) := '...';

    PROCEDURE get_context (
        r_version OUT VARCHAR2
    ) IS
    BEGIN
        r_version := g_version;
    END get_context;

BEGIN
    SELECT
        replace(
            lower(regexp_replace(
                sys_context('USERENV', 'CURRENT_EDITION_NAME'),
                '^[A-Z0-9#$_]+_V_',
                'v'
            )),
            '_',
            '.'
        )
    INTO g_version
    FROM
        dual;

END pck_app;
/

