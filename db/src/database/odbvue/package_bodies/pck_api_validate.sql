CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_validate AS

    FUNCTION num_try (
        p_str IN VARCHAR2,
        p_ok  OUT BOOLEAN
    ) RETURN NUMBER IS
        v_num NUMBER;
    BEGIN
        IF p_str IS NULL THEN
            p_ok := FALSE;
            RETURN NULL;
        END IF;
        BEGIN
      -- force dot decimal regardless of session NLS
            v_num := TO_NUMBER ( p_str, 'TM9', 'NLS_NUMERIC_CHARACTERS=.,' );
            p_ok := TRUE;
            RETURN v_num;
        EXCEPTION
            WHEN OTHERS THEN
                p_ok := FALSE;
                RETURN NULL;
        END;

    END;

    FUNCTION str_len (
        p_str IN VARCHAR2
    ) RETURN PLS_INTEGER IS
    BEGIN
        RETURN nvl(
            length(p_str),
            0
        );
    END;

    FUNCTION starts_with (
        p_str    IN VARCHAR2,
        p_prefix IN VARCHAR2
    ) RETURN BOOLEAN IS
    BEGIN
        RETURN
            p_prefix IS NOT NULL
            AND p_str IS NOT NULL
            AND substr(p_str,
                       1,
                       length(p_prefix)) = p_prefix;
    END;

    FUNCTION ends_with (
        p_str    IN VARCHAR2,
        p_suffix IN VARCHAR2
    ) RETURN BOOLEAN IS
    BEGIN
        RETURN
            p_suffix IS NOT NULL
            AND p_str IS NOT NULL
            AND substr(p_str,
                       -length(p_suffix)) = p_suffix;
    END;

    FUNCTION contains_substr (
        p_str  IN VARCHAR2,
        p_part IN VARCHAR2
    ) RETURN BOOLEAN IS
    BEGIN
        RETURN
            p_part IS NOT NULL
            AND p_str IS NOT NULL
            AND instr(p_str, p_part) > 0;
    END;

    FUNCTION is_email (
        p_str IN VARCHAR2
    ) RETURN BOOLEAN IS
    BEGIN
    -- close to the JS one: /^[\w.-]+@([\w-]+\.)+[\w-]{2,4}$/
        RETURN
            p_str IS NOT NULL
            AND regexp_like(p_str, '^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z0-9-]{2,}$');
    END;

    FUNCTION is_url (
        p_str IN VARCHAR2
    ) RETURN BOOLEAN IS
    BEGIN
    -- Approx of: ^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/\S*)?$
        RETURN
            p_str IS NOT NULL
            AND regexp_like(p_str, '^(https?://)?([A-Za-z0-9-]+\.)+[A-Za-z0-9-]+(/.*)?$');
    END;

    FUNCTION is_password (
        p_str IN VARCHAR2
    ) RETURN BOOLEAN IS
    BEGIN
        RETURN
            p_str IS NOT NULL
            AND length(p_str) >= 8
            AND regexp_like(p_str, '[A-Za-z]')
            AND regexp_like(p_str, '[0-9]')
            AND regexp_like(p_str, '^[A-Za-z0-9]+$');
    END;

    FUNCTION is_ipv4 (
        p_str IN VARCHAR2
    ) RETURN BOOLEAN IS

        v1 VARCHAR2(3);
        v2 VARCHAR2(3);
        v3 VARCHAR2(3);
        v4 VARCHAR2(3);
        n1 NUMBER;
        n2 NUMBER;
        n3 NUMBER;
        n4 NUMBER;
        ok BOOLEAN;
    BEGIN
        IF p_str IS NULL THEN
            RETURN FALSE;
        END IF;

    -- Split into four octets
        v1 := regexp_substr(p_str, '^[0-9]{1,3}', 1, 1);
        v2 := regexp_substr(p_str, '\.([0-9]{1,3})', 1, 1, NULL,
                            1);
        v3 := regexp_substr(p_str, '\.([0-9]{1,3})', 1, 2, NULL,
                            1);
        v4 := regexp_substr(p_str, '\.([0-9]{1,3})', 1, 3, NULL,
                            1);
        IF v1 IS NULL
           OR v2 IS NULL
        OR v3 IS NULL
        OR v4 IS NULL THEN
            RETURN FALSE;
        END IF;

        n1 := num_try(v1, ok);
        IF NOT ok THEN
            RETURN FALSE;
        END IF;
        n2 := num_try(v2, ok);
        IF NOT ok THEN
            RETURN FALSE;
        END IF;
        n3 := num_try(v3, ok);
        IF NOT ok THEN
            RETURN FALSE;
        END IF;
        n4 := num_try(v4, ok);
        IF NOT ok THEN
            RETURN FALSE;
        END IF;
        RETURN
            n1 BETWEEN 0 AND 255
            AND n2 BETWEEN 0 AND 255
            AND n3 BETWEEN 0 AND 255
            AND n4 BETWEEN 0 AND 255
            AND regexp_like(p_str, '^[0-9]{1,3}(\.[0-9]{1,3}){3}$');

    END;

    FUNCTION is_json_text (
        p_str IN VARCHAR2
    ) RETURN BOOLEAN IS
        el json_element_t;
    BEGIN
        IF p_str IS NULL THEN
            RETURN FALSE;
        END IF;
        BEGIN
            el := json_element_t.parse(p_str);
            RETURN el IS NOT NULL;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN FALSE;
        END;

    END;

    FUNCTION json_get_string (
        o json_object_t,
        k VARCHAR2
    ) RETURN VARCHAR2 IS
    BEGIN
        IF o IS NULL
           OR NOT o.has(k) THEN
            RETURN NULL;
        END IF;

        RETURN o.get_string(k);
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;

    FUNCTION json_get_elem (
        o json_object_t,
        k VARCHAR2
    ) RETURN json_element_t IS
    BEGIN
        IF o IS NULL
           OR NOT o.has(k) THEN
            RETURN NULL;
        END IF;

        RETURN o.get(k);
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;

    FUNCTION array_includes (
        arr    json_array_t,
        needle VARCHAR2
    ) RETURN BOOLEAN IS
        i PLS_INTEGER := 0;
        e json_element_t;
    BEGIN
        IF arr IS NULL THEN
            RETURN FALSE;
        END IF;
        FOR i IN 0..arr.get_size - 1 LOOP
            e := arr.get(i);
            IF e.is_scalar THEN
                IF e.to_string = needle THEN
                    RETURN TRUE;
                END IF;
            END IF;

        END LOOP;

        RETURN FALSE;
    END;

    FUNCTION elem_to_string (
        e json_element_t
    ) RETURN VARCHAR2 IS
    BEGIN
        IF e IS NULL THEN
            RETURN NULL;
        END IF;
        IF e.is_scalar THEN
            RETURN e.to_string;
        ELSIF e.is_object
        OR e.is_array THEN
            RETURN e.to_string; -- JSON text
        ELSE
            RETURN NULL;
        END IF;

    END;

    FUNCTION eval_rule (
        p_value   IN VARCHAR2,
        p_type    IN VARCHAR2,
        p_params  IN json_element_t,
        p_message IN VARCHAR2
    ) RETURN VARCHAR2 IS

        v_msg    VARCHAR2(4000) := nvl(p_message, 'Validation failed: ' || p_type);
        v_ok     BOOLEAN := TRUE;
        v_num    NUMBER;
        v_num_ok BOOLEAN;
        v_min    NUMBER;
        v_max    NUMBER;
        v_arr    json_array_t;
        v_str    VARCHAR2(4000);
    BEGIN
        CASE lower(p_type)
            WHEN 'required' THEN
                IF p_value IS NULL
                   OR p_value = '' THEN
                    RETURN v_msg;
                END IF;
            WHEN 'min-length' THEN
                v_num := num_try(
                    elem_to_string(p_params),
                    v_num_ok
                );
                IF NOT v_num_ok
                OR str_len(p_value) < v_num THEN
                    RETURN v_msg;
                END IF;
            WHEN 'max-length' THEN
                v_num := num_try(
                    elem_to_string(p_params),
                    v_num_ok
                );
                IF NOT v_num_ok
                OR str_len(p_value) > v_num THEN
                    RETURN v_msg;
                END IF;
            WHEN 'equals' THEN
                IF p_value != elem_to_string(p_params) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'equals-not' THEN
                IF p_value = elem_to_string(p_params) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'same-as' THEN
                IF p_value != elem_to_string(p_params) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'starts-with' THEN
                IF NOT starts_with(p_value,
                                   elem_to_string(p_params)) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'ends-with' THEN
                IF NOT ends_with(p_value,
                                 elem_to_string(p_params)) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'contains' THEN
                IF NOT contains_substr(p_value,
                                       elem_to_string(p_params)) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'greater-than' THEN
                v_num := num_try(
                    elem_to_string(p_params),
                    v_num_ok
                );
                IF NOT v_num_ok THEN
                    RETURN v_msg;
                END IF;
                DECLARE
                    v_val    NUMBER;
                    v_val_ok BOOLEAN;
                BEGIN
                    v_val := num_try(p_value, v_val_ok);
                    IF NOT v_val_ok
                    OR v_val <= v_num THEN
                        RETURN v_msg;
                    END IF;
                END;

            WHEN 'less-than' THEN
                v_num := num_try(
                    elem_to_string(p_params),
                    v_num_ok
                );
                IF NOT v_num_ok THEN
                    RETURN v_msg;
                END IF;
                DECLARE
                    v_val    NUMBER;
                    v_val_ok BOOLEAN;
                BEGIN
                    v_val := num_try(p_value, v_val_ok);
                    IF NOT v_val_ok
                    OR v_val >= v_num THEN
                        RETURN v_msg;
                    END IF;
                END;

            WHEN 'in-range' THEN
                IF p_params IS NULL
                   OR NOT p_params.is_array THEN
                    RETURN v_msg;
                END IF;
                v_arr := treat(p_params AS json_array_t);
                IF v_arr.get_size < 2 THEN
                    RETURN v_msg;
                END IF;
                v_min := num_try(v_arr.get(0).to_string,
                                 v_num_ok);
                IF NOT v_num_ok THEN
                    RETURN v_msg;
                END IF;
                v_max := num_try(v_arr.get(1).to_string,
                                 v_num_ok);
                IF NOT v_num_ok THEN
                    RETURN v_msg;
                END IF;
                DECLARE
                    v_val    NUMBER;
                    v_val_ok BOOLEAN;
                BEGIN
                    v_val := num_try(p_value, v_val_ok);
                    IF NOT v_val_ok
                    OR v_val < v_min
                    OR v_val > v_max THEN
                        RETURN v_msg;
                    END IF;
                END;

            WHEN 'includes' THEN
                IF p_params IS NULL
                   OR NOT p_params.is_array THEN
                    RETURN v_msg;
                END IF;
                v_arr := treat(p_params AS json_array_t);
                IF NOT array_includes(v_arr, p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'set' THEN
                IF p_params IS NULL
                   OR NOT p_params.is_array THEN
                    RETURN v_msg;
                END IF;
                v_arr := treat(p_params AS json_array_t);
                IF NOT array_includes(v_arr, p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'password' THEN
                IF NOT is_password(p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'email' THEN
                IF NOT is_email(p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'url' THEN
                IF NOT is_url(p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'ip' THEN
                IF NOT is_ipv4(p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'regexp' THEN
                v_str := elem_to_string(p_params);
                IF v_str IS NULL
                   OR NOT regexp_like(p_value, v_str) THEN
                    RETURN v_msg;
                END IF;

            WHEN 'is-json' THEN
                IF NOT is_json_text(p_value) THEN
                    RETURN v_msg;
                END IF;
            WHEN 'custom' THEN
        -- JS allows a function; PL/SQL cannot execute passed code.
                RETURN nvl(p_message, 'Validation failed: custom rule is not supported in PL/SQL');
            ELSE
                RETURN 'Validation failed: unknown rule type "'
                       || p_type
                       || '"';
        END CASE;

        RETURN NULL; -- passed
    END;

    FUNCTION validate (
        p_value IN VARCHAR2,
        p_rules IN CLOB
    ) RETURN VARCHAR2 IS

        el     json_element_t;
        rulese json_element_t;
        ruleo  json_object_t;
        rulesa json_array_t;
        i      PLS_INTEGER;
        v_type VARCHAR2(200);
        v_msg  VARCHAR2(4000);
        v_err  VARCHAR2(4000);
    BEGIN
        IF p_rules IS NULL
           OR dbms_lob.getlength(p_rules) = 0 THEN
            RETURN NULL; -- no rules => valid
        END IF;

        el := json_element_t.parse(p_rules);

    -- Accept either: rule object, array of rule objects, or { "rules": [...] }
        IF el.is_object THEN
            ruleo := treat(el AS json_object_t);
            IF ruleo.has('rules') THEN
                rulese := ruleo.get('rules');
                IF rulese.is_array THEN
                    rulesa := treat(rulese AS json_array_t);
                ELSE
          -- single object inside "rules"
                    IF rulese.is_object THEN
                        rulesa := NEW json_array_t();
                        rulesa.append(rulese);
                    ELSE
                        RETURN 'Invalid JSON: "rules" must be an array or object';
                    END IF;
                END IF;

            ELSE
        -- a single rule object
                rulesa := NEW json_array_t();
                rulesa.append(el);
            END IF;

        ELSIF el.is_array THEN
            rulesa := treat(el AS json_array_t);
        ELSE
            RETURN 'Invalid JSON: rules must be an object or an array';
        END IF;

    -- Iterate and fast-fail
        FOR i IN 0..rulesa.get_size - 1 LOOP
            ruleo := treat(rulesa.get(i) AS json_object_t);
            IF ruleo IS NULL THEN
                RETURN 'Invalid rule at index ' || i;
            END IF;
            v_type := lower(json_get_string(ruleo, 'type'));
            v_msg := json_get_string(ruleo, 'message');
            v_err := eval_rule(
                p_value   => p_value,
                p_type    => v_type,
                p_params  => json_get_elem(ruleo, 'params'),
                p_message => v_msg
            );

            IF v_err IS NOT NULL THEN
                RETURN v_err; -- fast fail
            END IF;
        END LOOP;

        RETURN NULL; -- all good
    EXCEPTION
        WHEN OTHERS THEN
            RETURN 'Validation error: ' || sqlerrm;
    END;

END pck_api_validate;
/


-- sqlcl_snapshot {"hash":"6c3cdda87035ad083bca0fca27237d822d755593","type":"PACKAGE_BODY","name":"PCK_API_VALIDATE","schemaName":"ODBVUE","sxml":""}