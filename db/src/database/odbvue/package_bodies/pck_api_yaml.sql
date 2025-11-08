CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_yaml IS

    FUNCTION init RETURN CLOB IS
    BEGIN
        RETURN '';
    END init;

    FUNCTION EXISTS (
        c CLOB,
        p VARCHAR2
    ) RETURN BOOLEAN IS
        r CLOB := to_json(c);
    BEGIN
        RETURN pck_api_json.EXISTS(r, p);
    END EXISTS;

    FUNCTION read (
        c CLOB,
        p VARCHAR2
    ) RETURN CLOB IS
        r CLOB := to_json(c);
        t VARCHAR2(30 CHAR);
    BEGIN
        t := pck_api_json.typeof(r, p);
        r := pck_api_json.read(r, p);
        IF ( t = 'object' )
        OR ( t = 'array' ) THEN
            RETURN pck_api_json.to_yaml(r);
        END IF;

        RETURN r;
    END read;

    FUNCTION typeof (
        c CLOB,
        p VARCHAR2
    ) RETURN VARCHAR2 IS
        r CLOB := to_json(c);
    BEGIN
        RETURN pck_api_json.typeof(r, p);
    END typeof;

    FUNCTION elcount (
        c CLOB,
        p VARCHAR2
    ) RETURN PLS_INTEGER IS
        r CLOB := to_json(c);
    BEGIN
        RETURN pck_api_json.elcount(r, p);
    END elcount;

    FUNCTION keys (
        c CLOB,
        p VARCHAR2
    ) RETURN VARCHAR2 IS
        r CLOB := to_json(c);
    BEGIN
        RETURN pck_api_json.keys(r, p);
    END keys;

    PROCEDURE write (
        c IN OUT NOCOPY CLOB,
        p VARCHAR2,
        v CLOB
    ) IS

        r  CLOB := to_json(c);
        t  VARCHAR2(30 CHAR);
        c2 CLOB;
        r2 CLOB;
        v2 CLOB;
    BEGIN
        c2 := to_json(c);
        BEGIN
            v2 := to_json(coalesce(v, 'null'));
        EXCEPTION
            WHEN OTHERS THEN
                v2 := v;
        END;

        pck_api_json.write(c2, p, v2);
        c := pck_api_json.to_yaml(c2);
    END write;

    PROCEDURE print (
        c IN OUT NOCOPY CLOB
    ) IS
    BEGIN
        NULL;
    END print;

    FUNCTION to_xml (
        c IN CLOB
    ) RETURN CLOB IS
    BEGIN
        RETURN pck_api_json.to_xml(to_json(c));
    END;

    FUNCTION to_json (
        c IN CLOB
    ) RETURN CLOB IS

        out            CLOB;
        pos            PLS_INTEGER := 1;
        len            PLS_INTEGER := dbms_lob.getlength(c);
        line           VARCHAR2(32767);
        SUBTYPE t_kind IS VARCHAR2(3); -- 'obj' or 'arr'

        TYPE t_frame IS RECORD (
                kind   t_kind,
                indent PLS_INTEGER,
                first  BOOLEAN
        );
        TYPE t_stack IS
            TABLE OF t_frame INDEX BY PLS_INTEGER;
        st             t_stack;
        sp             PLS_INTEGER := 0;
        pending_key    VARCHAR2(32767);
        pending_indent PLS_INTEGER := -1;

        FUNCTION json_escape (
            p IN VARCHAR2
        ) RETURN VARCHAR2 IS
            v VARCHAR2(32767) := nvl(p, '');
        BEGIN
            v := replace(v, '\', '\\');
            v := replace(v, '"', '\"');
            v := replace(v,
                         chr(8),
                         '\b');
            v := replace(v,
                         chr(9),
                         '\t');
            v := replace(v,
                         chr(10),
                         '\n');
            v := replace(v,
                         chr(12),
                         '\f');
            v := replace(v,
                         chr(13),
                         '\r');
            RETURN v;
        END;

        FUNCTION to_json_scalar (
            p_raw IN VARCHAR2
        ) RETURN VARCHAR2 IS
            v VARCHAR2(32767) := trim(p_raw);
        BEGIN
            IF v IS NULL THEN
                RETURN 'null';
            END IF;
            IF (
                substr(v, 1, 1) IN ( '"', '''' )
                AND substr(v, -1, 1) = substr(v, 1, 1)
            ) THEN
                v := substr(v,
                            2,
                            length(v) - 2);
                RETURN '"'
                       || json_escape(v)
                       || '"';
            END IF;

            IF lower(v) IN ( 'true', 'false', 'null' ) THEN
                RETURN lower(v);
            END IF;

            IF regexp_like(v, '^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$') THEN
                RETURN v;
            END IF;
            RETURN '"'
                   || json_escape(v)
                   || '"';
        END;

        PROCEDURE append (
            io IN OUT CLOB,
            s  IN VARCHAR2
        ) IS
        BEGIN
            dbms_lob.writeappend(io,
                                 length(s),
                                 s);
        END;

        FUNCTION leading_spaces (
            p IN VARCHAR2
        ) RETURN PLS_INTEGER IS
        BEGIN
            RETURN nvl(
                length(regexp_substr(p, '^\s*')),
                0
            );
        END;

        FUNCTION strip_line (
            p IN VARCHAR2
        ) RETURN VARCHAR2 IS
            l VARCHAR2(32767) := rtrim(p);
        BEGIN
            IF l IS NULL
               OR regexp_like(l, '^\s*(#|$)') THEN
                RETURN NULL;
            END IF;
            RETURN l;
        END;

        FUNCTION next_line (
            cl  IN CLOB,
            pos IN OUT PLS_INTEGER,
            len IN PLS_INTEGER
        ) RETURN VARCHAR2 IS
            ch  VARCHAR2(1);
            buf VARCHAR2(32767);
        BEGIN
            IF pos > len THEN
                RETURN NULL;
            END IF;
            LOOP
                ch := dbms_lob.substr(cl, 1, pos);
                pos := pos + 1;
                IF ch = chr(10) THEN
                    EXIT;
                END IF;
                IF ch <> chr(13) THEN
                    buf := buf || ch;
                END IF;

                EXIT WHEN pos > len;
            END LOOP;

            RETURN buf;
        END;

        PROCEDURE push (
            kind   t_kind,
            indent PLS_INTEGER
        ) IS
        BEGIN
            sp := sp + 1;
            st(sp).kind := kind;
            st(sp).indent := indent;
            st(sp).first := TRUE;
            IF out IS NULL THEN
                dbms_lob.createtemporary(out, TRUE);
            END IF;
            append(out,
                   CASE kind
                       WHEN 'obj' THEN
                           '{'
                       ELSE
                           '['
                   END
            );
        END;

        PROCEDURE add_comma IS
        BEGIN
            IF sp > 0 THEN
                IF st(sp).first THEN
                    st(sp).first := FALSE;
                ELSE
                    append(out, ',');
                END IF;

            END IF;
        END;

        PROCEDURE close_one IS
        BEGIN
            IF sp = 0 THEN
                RETURN;
            END IF;
            append(out,
                   CASE st(sp).kind
                    WHEN 'obj' THEN
                        '}'
                    ELSE
                        ']'
                   END
            );

            sp := sp - 1;
        END;

        PROCEDURE close_to (
            indent PLS_INTEGER
        ) IS
        BEGIN
            WHILE
                sp > 0
                AND indent <= st(sp).indent
            LOOP
                close_one;
            END LOOP;
        END;

        PROCEDURE materialize_pending_as (
            kind t_kind
        ) IS
        BEGIN
            IF sp = 0
            OR st(sp).kind <> 'obj' THEN
                push('obj', pending_indent - 2);
            END IF;

            add_comma;
            append(out,
                   '"'
                   || json_escape(pending_key)
                   || '":');
            push(kind, pending_indent);
            pending_key := NULL;
            pending_indent := -1;
        END;

    BEGIN
        IF out IS NULL THEN
            dbms_lob.createtemporary(out, TRUE);
        END IF;
        LOOP
            line := next_line(c, pos, len);
            EXIT WHEN line IS NULL;
            line := strip_line(line);
            IF line IS NULL THEN
                CONTINUE;
            END IF;
            DECLARE
                ind PLS_INTEGER := leading_spaces(line);
                raw VARCHAR2(32767) := ltrim(line);
            BEGIN
                close_to(ind);
                IF
                    pending_key IS NOT NULL
                    AND ind > pending_indent
                THEN
                    IF regexp_like(raw, '^\-\s') THEN
                        materialize_pending_as('arr');
                    ELSE
                        materialize_pending_as('obj');
                    END IF;

                END IF;

                IF regexp_like(raw, '^\-\s') THEN
                    raw := regexp_replace(raw, '^\-\s*', '');
                    IF sp = 0
                    OR st(sp).kind <> 'arr' THEN
                        IF pending_key IS NOT NULL THEN
                            materialize_pending_as('arr');
                        ELSE
                            push('arr', ind - 2);
                        END IF;

                    END IF;

                    IF regexp_like(raw, '^\w[^:]*:\s*') THEN
                        add_comma;
                        append(out, '{');
                        sp := sp + 1;
                        st(sp).kind := 'obj';
                        st(sp).indent := ind;
                        st(sp).first := TRUE;
                        DECLARE
                            k VARCHAR2(32767) := regexp_substr(raw, '^([^:]+):', 1, 1, NULL,
                                                               1);
                            v VARCHAR2(32767) := trim(regexp_substr(raw, '^[^:]+:\s*(.*)$', 1, 1, NULL,
                                                                    1));
                        BEGIN
                            add_comma;
                            append(out,
                                   '"'
                                   || json_escape(trim(k))
                                   || '":'
                                   ||
                                CASE
                                    WHEN v IS NULL THEN
                                        'null'
                                    ELSE
                                        to_json_scalar(v)
                                END
                            );

                        END;

                    ELSE
                        add_comma;
                        append(out,
                               to_json_scalar(raw));
                    END IF;

                ELSIF regexp_like(raw, '^[^:]+:\s*(.*)$') THEN
                    DECLARE
                        k VARCHAR2(32767) := regexp_substr(raw, '^([^:]+):', 1, 1, NULL,
                                                           1);
                        v VARCHAR2(32767) := trim(regexp_substr(raw, '^[^:]+:\s*(.*)$', 1, 1, NULL,
                                                                1));
                    BEGIN
                        IF sp = 0
                        OR st(sp).kind <> 'obj' THEN
                            push('obj', ind - 2);
                        END IF;

                        IF v IS NULL
                           OR v = '' THEN
                            pending_key := trim(k);
                            pending_indent := ind;
                        ELSE
                            add_comma;
                            append(out,
                                   '"'
                                   || json_escape(trim(k))
                                   || '":'
                                   || to_json_scalar(v));

                        END IF;

                    END;
                ELSE
                    IF sp = 0
                    OR st(sp).kind <> 'arr' THEN
                        push('arr', ind - 2);
                    END IF;

                    add_comma;
                    append(out,
                           to_json_scalar(raw));
                END IF;

            END;

        END LOOP;

        IF pending_key IS NOT NULL THEN
            IF sp = 0
            OR st(sp).kind <> 'obj' THEN
                push('obj', pending_indent - 2);
            END IF;

            add_comma;
            append(out,
                   '"'
                   || json_escape(pending_key)
                   || '":{}');
            pending_key := NULL;
        END IF;

        WHILE sp > 0 LOOP
            close_one;
        END LOOP;
        RETURN out;
    END to_json;

END pck_api_yaml;
/


-- sqlcl_snapshot {"hash":"23943b99a2d7d1a581e5711838ff481a569dc25c","type":"PACKAGE_BODY","name":"PCK_API_YAML","schemaName":"ODBVUE","sxml":""}