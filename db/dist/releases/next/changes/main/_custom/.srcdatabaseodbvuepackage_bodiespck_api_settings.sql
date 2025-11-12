-- liquibase formatted sql
-- changeset  SqlCl:1762984310893 stripComments:false logicalFilePath:main\_custom\.srcdatabaseodbvuepackage_bodiespck_api_settings.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\.srcdatabaseodbvuepackage_bodiespck_api_settings.sql:null:null:custom



CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_settings AS

    PROCEDURE write (
        p_id      app_settings.id%TYPE,
        p_name    app_settings.name%TYPE,
        p_value   app_settings.value%TYPE,
        p_options app_settings.options%TYPE DEFAULT NULL
    ) IS
    BEGIN
        MERGE INTO app_settings t
        USING (
            SELECT
                p_id id
            FROM
                dual
        ) s ON ( t.id = s.id )
        WHEN MATCHED THEN UPDATE
        SET t.value = p_value,
            t.name = coalesce(p_name, t.name),
            t.options = coalesce(p_options, t.options)
        WHEN NOT MATCHED THEN
        INSERT (
            id,
            name,
            value,
            options )
        VALUES
            ( p_id,
              p_name,
              p_value,
              p_options );

    END write;

    PROCEDURE read (
        p_id    app_settings.id%TYPE,
        r_value OUT app_settings.value%TYPE
    ) IS
    BEGIN
        SELECT
            value
        INTO r_value
        FROM
            app_settings
        WHERE
            id = p_id;

    END read;

    FUNCTION read (
        p_id app_settings.id%TYPE
    ) RETURN app_settings.value%TYPE IS
        v_value app_settings.value%TYPE;
    BEGIN
        read(p_id, v_value);
        RETURN v_value;
    END read;

    PROCEDURE remove (
        p_id app_settings.id%TYPE
    ) IS
    BEGIN
        DELETE FROM app_settings
        WHERE
            id = p_id;

    END remove;

END;
/
