CREATE OR REPLACE PACKAGE BODY odb_jwt AS

  -- PRIVATE

    c_epoch CONSTANT TIMESTAMP := to_timestamp('1970-01-01', 'YYYY-MM-DD');

    FUNCTION signature ( -- HS256 signature of the signing input, Base64URL-encoded
        p_input  VARCHAR2,
        p_secret VARCHAR2
    ) RETURN VARCHAR2 AS
        v_mac RAW(32);
    BEGIN
        v_mac := dbms_crypto.mac(utl_raw.cast_to_raw(p_input), dbms_crypto.hmac_sh256, utl_raw.cast_to_raw(p_secret));
        RETURN translate(replace(utl_raw.cast_to_varchar2(utl_encode.base64_encode(v_mac)), '='), unistr('+/=\000a\000d'), '-_');
    END;

  -- PUBLIC

    FUNCTION to_epoch (
        p_timestamp TIMESTAMP DEFAULT sys_extract_utc(systimestamp)
    ) RETURN INTEGER AS
    BEGIN
        RETURN floor((CAST(p_timestamp AS DATE) - CAST(c_epoch AS DATE)) * 86400);
    END;

    FUNCTION from_epoch (
        p_epoch INTEGER
    ) RETURN TIMESTAMP AS
    BEGIN
        RETURN c_epoch + numtodsinterval(p_epoch, 'SECOND');
    END;

    FUNCTION base64url_encode (
        p_input VARCHAR2
    ) RETURN VARCHAR2 AS
    BEGIN
        RETURN translate(replace(utl_raw.cast_to_varchar2(utl_encode.base64_encode(utl_raw.cast_to_raw(p_input))), '='),
                         unistr('+/=\000a\000d'), '-_');
    END;

    FUNCTION base64url_decode (
        p_input VARCHAR2
    ) RETURN VARCHAR2 AS
        v_b64 VARCHAR2(4000 CHAR);
    BEGIN
        IF p_input IS NULL THEN
            RETURN NULL;
        END IF;
        -- Restore standard Base64 alphabet and re-pad to a multiple of 4.
        v_b64 := translate(p_input, '-_', '+/');
        v_b64 := rpad(v_b64, length(v_b64) + mod(4 - mod(length(v_b64), 4), 4), '=');
        RETURN utl_raw.cast_to_varchar2(utl_encode.base64_decode(utl_raw.cast_to_raw(v_b64)));
    END;

    FUNCTION encode (
        p_payload VARCHAR2,
        p_secret  VARCHAR2
    ) RETURN VARCHAR2 AS
        v_signing_input VARCHAR2(4000 CHAR);
    BEGIN
        v_signing_input := base64url_encode('{"alg":"HS256","typ":"JWT"}')
                           || '.'
                           || base64url_encode(p_payload);
        RETURN v_signing_input
               || '.'
               || signature(v_signing_input, p_secret);
    END;

    FUNCTION verify (
        p_token  VARCHAR2,
        p_secret VARCHAR2
    ) RETURN boolean AS
        v_dot2 PLS_INTEGER;
    BEGIN
        v_dot2 := instr(p_token, '.', 1, 2);
        IF v_dot2 = 0 THEN
            RETURN 0;
        END IF;
        RETURN
            CASE
                WHEN signature(substr(p_token, 1, v_dot2 - 1), p_secret) = substr(p_token, v_dot2 + 1) THEN
                    1
                ELSE
                    0
            END;
    END;

    FUNCTION payload (
        p_token VARCHAR2
    ) RETURN VARCHAR2 AS
        v_dot1 PLS_INTEGER;
        v_dot2 PLS_INTEGER;
    BEGIN
        v_dot1 := instr(p_token, '.');
        v_dot2 := instr(p_token, '.', 1, 2);
        IF v_dot1 = 0 OR v_dot2 = 0 THEN
            RETURN NULL;
        END IF;
        RETURN base64url_decode(substr(p_token, v_dot1 + 1, v_dot2 - v_dot1 - 1));
    END;

    FUNCTION claim (
        p_token VARCHAR2,
        p_name  VARCHAR2
    ) RETURN VARCHAR2 AS
        v_value   VARCHAR2(4000 CHAR);
        v_payload VARCHAR2(4000 CHAR) := payload(p_token);
    BEGIN
        IF v_payload IS NULL THEN
            RETURN NULL;
        END IF;
        SELECT
            json_value(v_payload, '$.' || p_name)
        INTO v_value
        FROM
            dual;
        RETURN v_value;
    END;

    FUNCTION is_expired (
        p_token  VARCHAR2,
        p_leeway INTEGER DEFAULT 0
    ) RETURN boolean AS
        v_exp NUMBER := to_number(claim(p_token, 'exp'));
    BEGIN
        IF v_exp IS NULL THEN
            RETURN 0;
        END IF;
        RETURN
            CASE
                WHEN v_exp + nvl(p_leeway, 0) < to_epoch() THEN
                    1
                ELSE
                    0
            END;
    END;

END;
/
