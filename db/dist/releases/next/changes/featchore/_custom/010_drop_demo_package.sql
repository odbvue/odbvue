-- liquibase formatted sql
-- changeset  SqlCl:1763928193446 stripComments:false logicalFilePath:featchore\_custom\010_drop_demo_package.sql
-- sqlcl_snapshot dist\releases\next\changes\featchore\_custom\010_drop_demo_package.sql:null:null:custom


BEGIN
    EXECUTE IMMEDIATE 'DROP PACKAGE PCK_DEMO';
EXCEPTION
    WHEN OTHERS THEN
        IF SQLCODE != -4043 THEN
            RAISE;
        END IF;
END;
/
