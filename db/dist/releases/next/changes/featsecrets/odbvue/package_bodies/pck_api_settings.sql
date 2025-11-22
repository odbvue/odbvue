-- liquibase formatted sql
-- changeset ODBVUE:1763841490707 stripComments:false  logicalFilePath:featsecrets\odbvue\package_bodies\pck_api_settings.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_settings.sql:b0186a057468befb8fa984e66015bd28d8ae367e:1d7f4792bba75414714e9b5642ff2fe72f92338a:alter

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_settings AS

    g_master_key RAW(32);

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
            CASE
                WHEN secret = 'Y' THEN
                    dec(value)
                ELSE
                    value
            END
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

    FUNCTION enc (
        p_value IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN utl_raw.cast_to_varchar2(utl_encode.base64_encode(dbms_crypto.encrypt(
            utl_raw.cast_to_raw(p_value),
            dbms_crypto.aes_cbc_pkcs5,
            g_master_key
        )));
    END enc;

    FUNCTION dec (
        p_value IN VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        RETURN utl_raw.cast_to_varchar2(dbms_crypto.decrypt(
            utl_encode.base64_decode(utl_raw.cast_to_raw(p_value)),
            dbms_crypto.aes_cbc_pkcs5,
            g_master_key
        ));
    END dec;

    PROCEDURE initialize_master_key IS

        v_resp  dbms_cloud_types.resp;
        v_json  CLOB;
        v_b64   VARCHAR2(32767);
        v_raw   RAW(32767);
        v_local VARCHAR2(32767);
        v_uri   VARCHAR2(2000 CHAR) := read('APP_SETTINGS_MASTER_KEY_URI');
    BEGIN
        v_resp := dbms_cloud.send_request(
            credential_name => 'OCI$RESOURCE_PRINCIPAL',
            uri             => v_uri,
            method          => dbms_cloud.method_get
        );

        v_json := dbms_cloud.get_response_text(v_resp);
        v_b64 := JSON_VALUE(v_json, '$.secretBundleContent.content');
        g_master_key := utl_encode.base64_decode(utl_raw.cast_to_raw(v_b64));
    EXCEPTION
        WHEN OTHERS THEN
            BEGIN
                pck_api_audit.warn('Master Key');
                v_local := read('APP_SETTINGS_MASTER_KEY_LOCAL');
                g_master_key := utl_raw.cast_to_raw(v_local);
            EXCEPTION
                WHEN OTHERS THEN
                    pck_api_audit.fatal('Master Key');
                    raise_application_error(-20001, 'Failed to initialize master key from local setting: ' || sqlerrm);
            END;
    END initialize_master_key;

BEGIN
    initialize_master_key;
END;
/

