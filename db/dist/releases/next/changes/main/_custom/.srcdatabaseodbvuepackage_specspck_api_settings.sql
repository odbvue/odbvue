-- liquibase formatted sql
-- changeset  SqlCl:1762984301108 stripComments:false logicalFilePath:main\_custom\.srcdatabaseodbvuepackage_specspck_api_settings.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\.srcdatabaseodbvuepackage_specspck_api_settings.sql:null:null:custom


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

    FUNCTION read (-- Function returns value of the setting with the specified id
        p_id app_settings.id%TYPE -- Id of the setting
    ) RETURN app_settings.value%TYPE; -- Value of the setting (variable character)

    PROCEDURE remove ( -- Procedure deletes setting with the specified id
        p_id app_settings.id%TYPE -- Id of the setting
    );

END;
/


