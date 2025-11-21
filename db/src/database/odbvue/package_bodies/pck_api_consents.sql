CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_consents AS

    FUNCTION lookup (
        p_language IN app_consents.language_id%TYPE DEFAULT NULL,
        p_active   IN app_consents.active%TYPE DEFAULT 'Y'
    ) RETURN CLOB IS
        v_result CLOB;
    BEGIN
        SELECT
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id' VALUE ac.id,
                            'language' VALUE ac.language_id,
                            'name' VALUE ac.name,
                            'created' VALUE to_char(ac.created, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                            'active' VALUE ac.active
                )
            )
        INTO v_result
        FROM
            app_consents ac
        WHERE
            ( p_language IS NULL
              OR ac.language_id = p_language )
            AND ac.active = p_active;

        RETURN v_result;
    END lookup;

    FUNCTION verify (
        p_user_id    IN app_user_consents.user_id%TYPE,
        p_consent_id IN app_user_consents.consent_id%TYPE
    ) RETURN CHAR IS
        v_consent_status CHAR(1 CHAR);
    BEGIN
        SELECT
            CASE
                WHEN COUNT(*) > 0 THEN
                    'Y'
                ELSE
                    'N'
            END
        INTO v_consent_status
        FROM
            app_user_consents
        WHERE
                user_id = p_user_id
            AND consent_id = p_consent_id;

        RETURN v_consent_status;
    END verify;

    PROCEDURE give (
        p_user_id    IN app_user_consents.user_id%TYPE,
        p_consent_id IN app_user_consents.consent_id%TYPE
    ) IS
    BEGIN
        INSERT INTO app_user_consents (
            user_id,
            consent_id,
            given,
            revoked
        ) VALUES ( p_user_id,
                   p_consent_id,
                   systimestamp,
                   NULL );

    END give;

    PROCEDURE withdraw (
        p_user_id    IN app_user_consents.user_id%TYPE,
        p_consent_id IN app_user_consents.consent_id%TYPE
    ) IS
    BEGIN
        UPDATE app_user_consents
        SET
            revoked = systimestamp
        WHERE
                user_id = p_user_id
            AND consent_id = p_consent_id;

    END withdraw;

    FUNCTION download (
        p_consent_id IN app_consents.id%TYPE
    ) RETURN CLOB IS
        v_content CLOB;
    BEGIN
        SELECT
            content
        INTO v_content
        FROM
            app_consents
        WHERE
            id = p_consent_id;

        RETURN v_content;
    END download;

END pck_api_consents;
/


-- sqlcl_snapshot {"hash":"b12762d97edc1a9378706229616f4d36f7a55782","type":"PACKAGE_BODY","name":"PCK_API_CONSENTS","schemaName":"ODBVUE","sxml":""}