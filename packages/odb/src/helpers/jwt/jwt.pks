CREATE OR REPLACE PACKAGE odb_jwt AS -- Package for JSON Web Token (JWT) sign/verify using HMAC-SHA256 (HS256).

    SUBTYPE boolean IS PLS_INTEGER RANGE 0..1;

    FUNCTION to_epoch ( -- Function converts a TIMESTAMP to Unix epoch seconds
        p_timestamp TIMESTAMP DEFAULT sys_extract_utc(systimestamp) -- Timestamp (UTC assumed); defaults to now
    ) RETURN INTEGER; -- Unix epoch seconds

    FUNCTION from_epoch ( -- Function converts Unix epoch seconds to a TIMESTAMP
        p_epoch INTEGER -- Unix epoch seconds
    ) RETURN TIMESTAMP; -- Timestamp (UTC)

    FUNCTION base64url_encode ( -- Function Base64URL-encodes a string (padding and line breaks stripped)
        p_input VARCHAR2 -- Plain text
    ) RETURN VARCHAR2; -- Base64URL text

    FUNCTION base64url_decode ( -- Function Base64URL-decodes a string (padding restored)
        p_input VARCHAR2 -- Base64URL text
    ) RETURN VARCHAR2; -- Plain text

    FUNCTION encode ( -- Function builds and signs a JWT (HS256)
        p_payload VARCHAR2, -- JSON claims payload
        p_secret  VARCHAR2 -- Signing secret
    ) RETURN VARCHAR2; -- Signed JWT (header.payload.signature)

    FUNCTION verify ( -- Function verifies a JWT signature
        p_token  VARCHAR2, -- JWT
        p_secret VARCHAR2 -- Signing secret
    ) RETURN boolean; -- 1 - valid signature, 0 - invalid or malformed

    FUNCTION payload ( -- Function returns the decoded JSON payload (no signature check)
        p_token VARCHAR2 -- JWT
    ) RETURN VARCHAR2; -- JSON claims payload

    FUNCTION claim ( -- Function reads a single claim from the payload (no signature check)
        p_token VARCHAR2, -- JWT
        p_name  VARCHAR2 -- Claim name, e.g. 'sub' or a JSON path like 'user.id'
    ) RETURN VARCHAR2; -- Claim value

    FUNCTION is_expired ( -- Function checks the exp claim against the current time
        p_token  VARCHAR2, -- JWT
        p_leeway INTEGER DEFAULT 0 -- Allowed clock skew in seconds
    ) RETURN boolean; -- 1 - expired, 0 - still valid or no exp claim

END;
/
