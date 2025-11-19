CREATE OR REPLACE PACKAGE odbvue.pck_app AS -- Package for the main application     
    PROCEDURE get_context ( -- Returns application context
        r_version OUT VARCHAR2 -- Application version
    );

END pck_app;
/


-- sqlcl_snapshot {"hash":"fe64d4e34da9554f2ec1382d724fb96303d641a7","type":"PACKAGE_SPEC","name":"PCK_APP","schemaName":"ODBVUE","sxml":""}