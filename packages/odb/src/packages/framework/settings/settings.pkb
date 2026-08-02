CREATE OR REPLACE PACKAGE BODY odb_settings AS

  -- PRIVATE

    -- AES-256-CBC with PKCS5 padding. A random IV is generated per value and
    -- stored alongside the ciphertext, so identical plain texts encrypt differently.
    c_encryption_type CONSTANT PLS_INTEGER := dbms_crypto.encrypt_aes256
                                              + dbms_crypto.chain_cbc
                                              + dbms_crypto.pad_pkcs5;

    -- Resolved once at package instantiation by initialize_master_key.
    g_master_key RAW(32);

    FUNCTION enc ( -- Encrypts a value: base64(IV || ciphertext)
        p_value IN VARCHAR2
    ) RETURN VARCHAR2 AS
        v_iv  RAW(16) := dbms_crypto.randombytes(16);
        v_enc RAW(32767);
    BEGIN
        v_enc := dbms_crypto.encrypt(utl_raw.cast_to_raw(p_value), c_encryption_type, g_master_key, v_iv);
        RETURN utl_raw.cast_to_varchar2(utl_encode.base64_encode(utl_raw.concat(v_iv, v_enc)));
    END enc;

    FUNCTION dec ( -- Decrypts a base64(IV || ciphertext) value produced by enc
        p_value IN VARCHAR2
    ) RETURN VARCHAR2 AS
        v_all RAW(32767) := utl_encode.base64_decode(utl_raw.cast_to_raw(p_value));
        v_iv  RAW(16) := utl_raw.substr(v_all, 1, 16);
        v_enc RAW(32767) := utl_raw.substr(v_all, 17);
    BEGIN
        RETURN utl_raw.cast_to_varchar2(dbms_crypto.decrypt(v_enc, c_encryption_type, g_master_key, v_iv));
    END dec;

  -- PUBLIC

    PROCEDURE write (
        p_id      IN VARCHAR2,
        p_name    IN VARCHAR2,
        p_value   IN VARCHAR2,
        p_options IN CLOB DEFAULT NULL,
        p_secret  IN VARCHAR2 DEFAULT 'N'
    ) AS
        v_value VARCHAR2(2000 CHAR) := p_value;
    BEGIN
        IF p_secret = 'Y' THEN
            v_value := enc(p_value);
        END IF;

        MERGE INTO odb_settings_store t
        USING ( SELECT p_id AS id FROM dual ) s ON ( t.id = s.id )
        WHEN MATCHED THEN UPDATE SET
            t.value   = v_value,
            t.name    = coalesce(p_name, t.name),
            t.options = coalesce(p_options, t.options),
            t.secret  = p_secret
        WHEN NOT MATCHED THEN
            INSERT ( id, name, value, options, secret )
            VALUES ( p_id, p_name, v_value, p_options, p_secret );
    END write;

    PROCEDURE read (
        p_id    IN VARCHAR2,
        r_value OUT VARCHAR2
    ) AS
        v_value  VARCHAR2(2000 CHAR);
        v_secret CHAR(1 CHAR);
    BEGIN
        SELECT value, secret
        INTO v_value, v_secret
        FROM odb_settings_store
        WHERE id = p_id;

        -- Decrypt in PL/SQL: dec() is private and cannot be called from SQL (PLS-00231).
        r_value := CASE WHEN v_secret = 'Y' THEN dec(v_value) ELSE v_value END;
    EXCEPTION
        WHEN no_data_found THEN
            raise_application_error(-20001, 'Setting with ID "' || p_id || '" not found.');
    END read;

    FUNCTION read (
        p_id IN VARCHAR2
    ) RETURN VARCHAR2 AS
        v_value VARCHAR2(2000 CHAR);
    BEGIN
        read(p_id, v_value);
        RETURN v_value;
    END read;

    PROCEDURE remove (
        p_id IN VARCHAR2
    ) AS
    BEGIN
        DELETE FROM odb_settings_store WHERE id = p_id;
    END remove;

    PROCEDURE initialize_master_key AS
        v_uri VARCHAR2(2000 CHAR);
        v_b64 VARCHAR2(32767);
    BEGIN
        -- 1) OCI Vault via resource principal, when an ODB_SETTINGS_MASTER_KEY_URI
        --    setting points at a secret bundle. Called through dynamic SQL so the
        --    body still compiles where DBMS_CLOUD is unavailable (e.g. local Oracle).
        v_uri := read('ODB_SETTINGS_MASTER_KEY_URI');
        EXECUTE IMMEDIATE q'[
            DECLARE
                v_resp dbms_cloud_types.resp;
                v_json CLOB;
            BEGIN
                v_resp := dbms_cloud.send_request(
                    credential_name => 'OCI$RESOURCE_PRINCIPAL',
                    uri             => :uri,
                    method          => dbms_cloud.method_get
                );
                v_json := dbms_cloud.get_response_text(v_resp);
                :b64 := JSON_VALUE(v_json, '$.secretBundleContent.content');
            END;
        ]'
        USING IN v_uri, OUT v_b64;
        g_master_key := utl_encode.base64_decode(utl_raw.cast_to_raw(v_b64));
    EXCEPTION
        WHEN OTHERS THEN
            -- 2) Fallback: key baked into the package at install time from the
            --    ODBVUE_SETTINGS_MASTER_KEY environment variable.
            g_master_key := HEXTORAW('__ODB_SETTINGS_MASTER_KEY__');
    END initialize_master_key;

BEGIN
    initialize_master_key;
END odb_settings;
/
