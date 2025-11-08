CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_json AS

    FUNCTION init RETURN CLOB AS
    BEGIN
        RETURN '{}';
    END;

    FUNCTION EXISTS (
        c IN CLOB,
        p IN VARCHAR2
    ) RETURN BOOLEAN AS
        n PLS_INTEGER := 0;
    BEGIN
        EXECUTE IMMEDIATE 'SELECT CASE WHEN JSON_EXISTS(:c, '
                          || dbms_assert.enquote_literal(p)
                          || ') THEN 1 ELSE 0 END FROM DUAL'
        INTO n
            USING c;

        RETURN n = 1;
    END;

    FUNCTION read (
        c IN CLOB,
        p IN VARCHAR2
    ) RETURN CLOB AS
        r CLOB := NULL;
    BEGIN
        EXECUTE IMMEDIATE 'SELECT JSON_QUERY(:c, '
                          || dbms_assert.enquote_literal(p)
                          || ' RETURNING CLOB NULL ON ERROR NULL ON EMPTY) FROM dual'
        INTO r
            USING c;

        IF ( r IS NULL ) THEN
            EXECUTE IMMEDIATE 'SELECT JSON_VALUE(:c, '
                              || dbms_assert.enquote_literal(p)
                              || ' RETURNING CLOB NULL ON ERROR NULL ON EMPTY) FROM dual'
            INTO r
                USING c;

        END IF;

        RETURN r;
    END;

    FUNCTION typeof (
        c IN CLOB,
        p IN VARCHAR2
    ) RETURN VARCHAR2 AS
        r CLOB;
    BEGIN
        r := read(c, p);
        IF ( r IS NULL ) THEN
            RETURN 'undefined';
        END IF;
        IF ( r = 'null' ) THEN
            RETURN 'null';
        END IF;
        IF ( r = 'true'
        OR r = 'false' ) THEN
            RETURN 'boolean';
        END IF;
        BEGIN
            DECLARE
                n NUMBER;
            BEGIN
                n := TO_NUMBER ( r );
                RETURN 'number';
            EXCEPTION
                WHEN OTHERS THEN
                    NULL;
            END;
        END;

        CASE dbms_lob.substr(r, 1, 1)
            WHEN '"' THEN
                RETURN 'string';
            WHEN '{' THEN
                RETURN 'object';
            WHEN '[' THEN
                RETURN 'array';
        END CASE;

        RETURN 'unknown';
    END;

    FUNCTION elcount (
        c IN CLOB,
        p IN VARCHAR2
    ) RETURN PLS_INTEGER AS
        r  CLOB;
        n  PLS_INTEGER := 0;
        jo json_object_t;
        ja json_array_t;
        jk json_key_list;
    BEGIN
        r := read(c, p);
        IF ( r IS NULL ) THEN
            RETURN NULL;
        END IF;
        CASE dbms_lob.substr(r, 1, 1)
            WHEN '{' THEN
                jo := json_object_t.parse(r);
                jk := jo.get_keys;
                RETURN jk.count;
            WHEN '[' THEN
                ja := json_array_t.parse(r);
                RETURN ja.get_size;
            ELSE
                RETURN 1; -- scalar value  
        END CASE;

    END;

    FUNCTION keys (
        c IN CLOB,
        p IN VARCHAR2
    ) RETURN VARCHAR2 AS
        r CLOB;
        j json_object_t;
        a json_array_t := NEW json_array_t;
        k json_key_list;
    BEGIN
        r := read(c, p);
        BEGIN
            j := json_object_t.parse(r);
            k := j.get_keys;
            FOR i IN 1..k.count LOOP
                a.append(k(i));
            END LOOP;

        EXCEPTION
            WHEN OTHERS THEN
                RETURN '[]';
        END;

        RETURN a.to_string;
    END;

    PROCEDURE write (
        c IN OUT NOCOPY CLOB,
        p IN VARCHAR2,
        v IN CLOB
    ) AS

        r CLOB;

        FUNCTION patch (
            p_path  IN VARCHAR2,
            p_value IN CLOB
        ) RETURN CLOB IS
            path VARCHAR2(32767) := substr(p_path, 3);
            n    PLS_INTEGER;
        BEGIN
            IF path IS NULL
               OR path = '' THEN
                RETURN p_value;
            END IF;
            n := length(path) - length(replace(path, '.', '')) + 1;

            RETURN '{"'
                   || replace(path, '.', '":{"')
                   || '":'
                   || p_value
                   || rpad('}', n, '}');

        END;

    BEGIN
        IF ( instr(p, '[') ) > 0 THEN
            raise_application_error(-20001, 'Not available for array paths yet');
            RETURN;
        END IF;

        IF
            p = '$'
            AND v IS NULL
        THEN
            c := '{}';
            RETURN;
        END IF;

        r := patch(p,
                   coalesce(v, 'null'));
        EXECUTE IMMEDIATE 'SELECT JSON_MERGEPATCH(:c, :r RETURNING CLOB) FROM dual'
        INTO c
            USING c, r;
    END;

    PROCEDURE print (
        c IN OUT NOCOPY CLOB
    ) AS
        r CLOB;
    BEGIN
        EXECUTE IMMEDIATE 'SELECT JSON_SERIALIZE(:c RETURNING CLOB PRETTY) FROM dual'
        INTO r
            USING c;
        c := r;
    END;

    FUNCTION to_xml (
        c CLOB
    ) RETURN CLOB IS

        j json_element_t;

        FUNCTION escape_xml_name (
            n VARCHAR2
        ) RETURN VARCHAR2 IS
            v VARCHAR2(4000) := regexp_replace(n, '[^A-Za-z0-9_.-]', '_');
        BEGIN
            IF regexp_like(v, '^[^A-Za-z_]') THEN
                v := 'n_' || v; -- XML names must start with letter or '_'
            END IF;

            RETURN v;
        END;

        FUNCTION escape_xml_value (
            e json_element_t
        ) RETURN CLOB IS
            s   CLOB := e.to_string;
            len PLS_INTEGER := dbms_lob.getlength(s);
        BEGIN
            IF (
                len >= 2
                AND dbms_lob.substr(s, 1, 1) = '"'
                AND dbms_lob.substr(s, 1, len) = '"'
            ) THEN
                s := dbms_lob.substr(s, len - 2, 2);
            END IF;

            RETURN dbms_xmlgen.convert(s, dbms_xmlgen.entity_encode);
        END;

        FUNCTION build_xml_node (
            e   json_element_t,
            tag VARCHAR2
        ) RETURN CLOB IS
            nm   VARCHAR2(4000) := escape_xml_name(tag);
            frag CLOB := '';
        BEGIN
            IF e IS NULL THEN
                RETURN '<'
                       || nm
                       || '/>';
            ELSIF e.is_object THEN
                DECLARE
                    obj  json_object_t := treat(e AS json_object_t);
                    keys json_key_list := obj.get_keys;
                BEGIN
                    FOR i IN 1..keys.count LOOP
                        frag := frag
                                || build_xml_node(
                            obj.get(keys(i)),
                            keys(i)
                        );
                    END LOOP;

                    RETURN '<'
                           || nm
                           || '>'
                           || frag
                           || '</'
                           || nm
                           || '>';

                END;
            ELSIF e.is_array THEN
                DECLARE
                    arr json_array_t := treat(e AS json_array_t);
                BEGIN
                    FOR i IN 0..arr.get_size - 1 LOOP
                        frag := frag
                                || build_xml_node(
                            arr.get(i),
                            'item'
                        );
                    END LOOP;

                    RETURN '<'
                           || nm
                           || '>'
                           || frag
                           || '</'
                           || nm
                           || '>';

                END;
            ELSE
                RETURN '<'
                       || nm
                       || '>'
                       || escape_xml_value(e)
                       || '</'
                       || nm
                       || '>';
            END IF;
        END;

    BEGIN
        j := json_element_t.parse(c);
        RETURN build_xml_node(j, 'root');
    END to_xml;

    FUNCTION to_yaml (
        c CLOB
    ) RETURN CLOB IS

        j json_element_t;

        FUNCTION indent (
            n PLS_INTEGER
        ) RETURN VARCHAR2 IS
        BEGIN
            RETURN rpad(' ', n, ' ');
        END;

        FUNCTION yaml_key (
            k VARCHAR2
        ) RETURN VARCHAR2 IS
        BEGIN
            IF regexp_like(k, '^[A-Za-z_][A-Za-z0-9_.-]*$') THEN
                RETURN k; -- safe unquoted key
            ELSE
                RETURN ''''
                       || replace(k, '''', '''''')
                       || '''';
            END IF;
        END;

        FUNCTION yaml_scalar (
            e json_element_t
        ) RETURN CLOB IS

            s   CLOB := e.to_string;           -- JSON text for the element
            len PLS_INTEGER := dbms_lob.getlength(s);
            v   VARCHAR2(32767);
        BEGIN
            IF s = 'null'
            OR s = 'true'
            OR s = 'false' THEN
                RETURN s;
            ELSIF
                len >= 2
                AND dbms_lob.substr(s, 1, 1) = '"'
                AND dbms_lob.substr(s, 1, len) = '"'
            THEN
      --s := DBMS_LOB.SUBSTR(s, len - 2, 2);
      --RETURN '''' || REPLACE(s, '''', '''''') || '''';
                v := dbms_lob.substr(s, len - 2, 2);  -- inner text of the JSON string
                IF
                    regexp_like(v, '^[A-Za-z0-9_./-]+$')
                    AND NOT regexp_like(v, '^(?:[-+]?[0-9]+(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?)$')
                THEN
                    RETURN v;
                ELSE
                    RETURN ''''
                           || replace(v, '''', '''''')
                           || '''';
                END IF;

            ELSE
                RETURN s;
            END IF;
        END;

        FUNCTION build_yaml (
            e   json_element_t,
            lvl PLS_INTEGER
        ) RETURN CLOB IS
            pad  VARCHAR2(4000) := indent(lvl);
            outx CLOB := '';
        BEGIN
            IF e IS NULL THEN
                RETURN pad
                       || 'null'
                       || chr(10);
            ELSIF e.is_object THEN
                DECLARE
                    obj  json_object_t := treat(e AS json_object_t);
                    keys json_key_list := obj.get_keys;
                BEGIN
                    IF keys.count = 0 THEN
                        RETURN pad
                               || '{}'
                               || chr(10);
                    END IF;

                    FOR i IN 1..keys.count LOOP
                        DECLARE
                            k   VARCHAR2(4000) := keys(i);
                            val json_element_t := obj.get(k);
                        BEGIN
                            IF val IS NULL
                               OR val.is_scalar THEN
                                outx := outx
                                        || pad
                                        || yaml_key(k)
                                        || ': '
                                        || yaml_scalar(val)
                                        || chr(10);

                            ELSIF val.is_object THEN
                                DECLARE
                                    o  json_object_t := treat(val AS json_object_t);
                                    kl json_key_list := o.get_keys;
                                BEGIN
                                    IF kl.count = 0 THEN
                                        outx := outx
                                                || pad
                                                || yaml_key(k)
                                                || ': {}'
                                                || chr(10);

                                    ELSE
                                        outx := outx
                                                || pad
                                                || yaml_key(k)
                                                || ':'
                                                || chr(10)
                                                || build_yaml(val, lvl + 2);
                                    END IF;

                                END;
                            ELSE -- array
                                DECLARE
                                    a json_array_t := treat(val AS json_array_t);
                                BEGIN
                                    IF a.get_size = 0 THEN
                                        outx := outx
                                                || pad
                                                || yaml_key(k)
                                                || ': []'
                                                || chr(10);

                                    ELSE
                                        outx := outx
                                                || pad
                                                || yaml_key(k)
                                                || ':'
                                                || chr(10)
                                                || build_yaml(val, lvl + 2);
                                    END IF;

                                END;
                            END IF;

                        END;
                    END LOOP;

                    RETURN outx;
                END;
            ELSIF e.is_array THEN
                DECLARE
                    arr json_array_t := treat(e AS json_array_t);
                BEGIN
                    IF arr.get_size = 0 THEN
                        RETURN pad
                               || '[]'
                               || chr(10);
                    END IF;

                    FOR i IN 0..arr.get_size - 1 LOOP
                        IF arr.get(i).is_scalar
                        OR arr.get(i) IS NULL THEN
                            outx := outx
                                    || pad
                                    || '- '
                                    || yaml_scalar(arr.get(i))
                                    || chr(10);

                        ELSE
            -- complex item: "-\n  ..." (indent inner by +2)
                            outx := outx
                                    || pad
                                    || '-'
                                    || chr(10)
                                    || build_yaml(
                                arr.get(i),
                                lvl + 2
                            );
                        END IF;
                    END LOOP;

                    RETURN outx;
                END;
            ELSE
                RETURN pad
                       || yaml_scalar(e)
                       || chr(10);
            END IF;
        END;

    BEGIN
        j := json_element_t.parse(c);
        RETURN build_yaml(j, 0);
    END to_yaml;

END pck_api_json;
/


-- sqlcl_snapshot {"hash":"50f0954ba42f2e2bac3096aa3a2ffcdf55493eb7","type":"PACKAGE_BODY","name":"PCK_API_JSON","schemaName":"ODBVUE","sxml":""}