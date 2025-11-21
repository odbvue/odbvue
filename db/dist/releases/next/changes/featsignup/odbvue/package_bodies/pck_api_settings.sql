-- liquibase formatted sql
-- changeset ODBVUE:1763765420082 stripComments:false  logicalFilePath:featsignup\odbvue\package_bodies\pck_api_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_settings.sql:ce2a0d3edfb9d4ab933460dd04445a63091a2e69:b0186a057468befb8fa984e66015bd28d8ae367e:alter

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

    EXCEPTION
        WHEN no_data_found THEN
            raise_application_error(-20001, 'Setting with ID "'
                                            || p_id
                                            || '" not found.');
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

