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


-- sqlcl_snapshot {"hash":"84c85557bdb80392b4079f6a0ce9b887becb4abf","type":"PACKAGE_SPEC","name":"PCK_API_SETTINGS","schemaName":"ODBVUE","sxml":""}