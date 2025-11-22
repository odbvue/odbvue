-- liquibase formatted sql
-- changeset ODBVUE:1763841490733 stripComments:false  logicalFilePath:featsecrets\odbvue\package_specs\pck_api_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_settings.sql:84c85557bdb80392b4079f6a0ce9b887becb4abf:02ca166ff7acc5301b31cfc9b97dd50766def49f:alter

CREATE OR REPLACE PACKAGE odbvue.pck_api_settings AS -- Package provides methods for managing application settings 
    PROCEDURE write ( -- Procedure sets value of the setting with the specified id
        p_id      app_settings.id%TYPE, -- Id of the setting
        p_name    app_settings.name%TYPE, -- Name of the setting
        p_value   app_settings.value%TYPE, -- Value of the setting (variable character)
        p_options app_settings.options%TYPE DEFAULT NULL -- Additional options in JSON format
    );

    PROCEDURE read ( -- Procedure returns value of the setting with the specified id
        p_id    app_settings.id%TYPE, -- Id of the setting
        r_value OUT app_settings.value%TYPE -- Value of the setting (variable character)
    );

    FUNCTION read ( -- Function returns value of the setting with the specified id
        p_id app_settings.id%TYPE -- Id of the setting
    ) RETURN app_settings.value%TYPE; -- Value of the setting (variable character)

    PROCEDURE remove ( -- Procedure deletes setting with the specified id
        p_id app_settings.id%TYPE -- Id of the setting
    );

    FUNCTION enc ( -- Function encrypts the provided value
        p_value IN VARCHAR2 -- Value to be encrypted
    ) RETURN VARCHAR2; -- Encrypted value

    FUNCTION dec ( -- Function decrypts the provided value
        p_value IN VARCHAR2 -- Value to be decrypted
    ) RETURN VARCHAR2; -- Decrypted value
END;
/

