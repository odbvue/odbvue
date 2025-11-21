-- liquibase formatted sql
-- changeset ODBVUE:1763714037281 stripComments:false  logicalFilePath:featconsents\odbvue\package_specs\pck_api_consents.sql
-- sqlcl_snapshot db/src/database/odbvue/package_specs/pck_api_consents.sql:null:fa920dda844ba385830346e16dc63ef6b3a6c7ff:create

CREATE OR REPLACE PACKAGE odbvue.pck_api_consents AS -- Package for managing user consents

    FUNCTION lookup ( -- Function to retrieve consent list
        p_language IN app_consents.language_id%TYPE DEFAULT NULL, -- Language filter for consents
        p_active   IN app_consents.active%TYPE DEFAULT 'Y' -- Active status filter
    ) RETURN CLOB; -- Returns consent list as CLOB

    FUNCTION verify ( -- Function to check if user has given consent
        p_user_id    IN app_user_consents.user_id%TYPE, -- User identifier
        p_consent_id IN app_user_consents.consent_id%TYPE -- Consent identifier
    ) RETURN CHAR; -- Returns 'Y' if consent given, 'N' otherwise

    PROCEDURE give ( -- Procedure to record user consent
        p_user_id    IN app_user_consents.user_id%TYPE, -- User identifier
        p_consent_id IN app_user_consents.consent_id%TYPE -- Consent identifier
    );

    PROCEDURE withdraw ( -- Procedure to revoke user consent
        p_user_id    IN app_user_consents.user_id%TYPE, -- User identifier
        p_consent_id IN app_user_consents.consent_id%TYPE -- Consent identifier
    );

    FUNCTION download ( -- Function to download consent content
        p_consent_id IN app_consents.id%TYPE -- Consent identifier
    ) RETURN CLOB; -- Returns consent content as CLOB
END pck_api_consents;
/

