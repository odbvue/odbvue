CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_xml AS

    FUNCTION init RETURN CLOB IS
    BEGIN
        RETURN '<root></root>';
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
            RETURN pck_api_json.to_xml(r);
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
            v2 := to_json(v);
            v2 := to_json('<root>'
                          || v || '</root>');
        EXCEPTION
            WHEN OTHERS THEN
                v2 := v;
        END;

        pck_api_json.write(c2, p, v2);
        c := pck_api_json.to_xml(c2);
    END write;

    PROCEDURE print (
        c IN OUT NOCOPY CLOB
    ) IS
        r CLOB;
    BEGIN
        SELECT
            XMLSERIALIZE(DOCUMENT x AS CLOB INDENT SIZE = 2) AS pretty_xml
        INTO r
        FROM
            (
                SELECT
                    xmltype(c) x
                FROM
                    dual
            );

        c := r;
    END print;

    FUNCTION to_yaml (
        c CLOB
    ) RETURN CLOB IS
        r CLOB := to_json(c);
    BEGIN
        RETURN pck_api_json.to_yaml(r);
    END;

    FUNCTION to_json (
        c CLOB
    ) RETURN CLOB IS

        v_xml   XMLTYPE;
        v_doc   dbms_xmldom.domdocument;
        v_root  dbms_xmldom.domelement;
        v_nodes dbms_xmldom.domnodelist;
        r       CLOB;

        FUNCTION build_json (
            n dbms_xmldom.domnodelist
        ) RETURN CLOB IS

            v_child  dbms_xmldom.domnode;
            v_grand  dbms_xmldom.domnode;
            v_kids   dbms_xmldom.domnodelist;
            i        PLS_INTEGER;
            j        PLS_INTEGER;
            has_sub  BOOLEAN;
            val      VARCHAR2(4000);
            arr_mode BOOLEAN;
            outc     CLOB;

            FUNCTION has_element_children (
                n dbms_xmldom.domnode
            ) RETURN BOOLEAN IS
                kids dbms_xmldom.domnodelist := dbms_xmldom.getchildnodes(n);
                i    PLS_INTEGER;
            BEGIN
                IF NOT dbms_xmldom.isnull(kids) THEN
                    FOR i IN 0..dbms_xmldom.getlength(kids) - 1 LOOP
                        IF dbms_xmldom.getnodetype(dbms_xmldom.item(kids, i)) = dbms_xmldom.element_node THEN
                            RETURN TRUE;
                        END IF;
                    END LOOP;
                END IF;

                RETURN FALSE;
            END;

            FUNCTION is_array (
                lst dbms_xmldom.domnodelist
            ) RETURN BOOLEAN IS

                i        PLS_INTEGER;
                child    dbms_xmldom.domnode;
                first_nm VARCHAR2(4000) := NULL;
                nm       VARCHAR2(4000);
                el_count PLS_INTEGER := 0;
            BEGIN
                IF dbms_xmldom.isnull(lst) THEN
                    RETURN FALSE;
                END IF;
                FOR i IN 0..dbms_xmldom.getlength(lst) - 1 LOOP
                    child := dbms_xmldom.item(lst, i);
                    IF dbms_xmldom.getnodetype(child) = dbms_xmldom.element_node THEN
                        el_count := el_count + 1;
                        nm := dbms_xmldom.getnodename(child);
                        IF first_nm IS NULL THEN
                            first_nm := nm;
                        ELSIF nm <> first_nm THEN
                            RETURN FALSE; -- different names => not an array
                        END IF;

                    END IF;

                END LOOP;
  -- Array requires at least 2 elements with same name
                RETURN el_count >= 2;
            END;

            FUNCTION emit_scalar (
                p VARCHAR2
            ) RETURN VARCHAR2 IS

                v VARCHAR2(32767) := trim(p);

                FUNCTION is_bool (
                    p VARCHAR2
                ) RETURN BOOLEAN IS
                BEGIN
                    RETURN lower(trim(p)) IN ( 'true', 'false' );
                END;

                FUNCTION is_null (
                    p VARCHAR2
                ) RETURN BOOLEAN IS
                BEGIN
                    RETURN lower(trim(p)) = 'null';
                END;

                FUNCTION is_num (
                    p VARCHAR2
                ) RETURN BOOLEAN IS
                    n NUMBER;
                BEGIN
                    n := TO_NUMBER ( TRIM(p) );
                    RETURN TRUE;
                EXCEPTION
                    WHEN OTHERS THEN
                        RETURN FALSE;
                END;

                FUNCTION esc_json (
                    p VARCHAR2
                ) RETURN VARCHAR2 IS
                    v VARCHAR2(32767) := nvl(p, '');
                BEGIN
                    v := replace(v, '\', '\\');
                    v := replace(v, '"', '\"');
                    v := replace(v,
                                 chr(9),
                                 '\t');
                    v := replace(v,
                                 chr(10),
                                 '\n');
                    v := replace(v,
                                 chr(13),
                                 '\r');
                    RETURN v;
                END;

            BEGIN
                IF v IS NULL
                   OR is_null(v) THEN
                    RETURN 'null';
                ELSIF is_bool(v) THEN
                    RETURN lower(v);
                ELSIF is_num(v) THEN
                    RETURN v;
                ELSE
                    RETURN '"'
                           || esc_json(v)
                           || '"';
                END IF;
            END;

        BEGIN
            arr_mode := is_array(n);
            outc :=
                CASE
                    WHEN arr_mode THEN
                        '['
                    ELSE
                        '{'
                END;
            FOR i IN 0..nvl(
                dbms_xmldom.getlength(n),
                0
            ) - 1 LOOP
                v_child := dbms_xmldom.item(n, i);

    -- only element children
                IF dbms_xmldom.getnodetype(v_child) = dbms_xmldom.element_node THEN

      -- decide scalar vs complex
                    v_kids := dbms_xmldom.getchildnodes(v_child);
                    has_sub := has_element_children(v_child);
                    IF arr_mode THEN
        -- ARRAY: no keys, only values
                        IF has_sub THEN
                            outc := outc
                                    || build_json(v_kids)
                                    || ',';
                        ELSE
                            val := trim(dbms_xmldom.getnodevalue(dbms_xmldom.getfirstchild(v_child)));
                            outc := outc
                                    || emit_scalar(val)
                                    || ',';
                        END IF;
                    ELSE
        -- OBJECT: key : value
                        IF has_sub THEN
                            outc := outc
                                    || '"'
                                    || dbms_xmldom.getnodename(v_child)
                                    || '":'
                                    || build_json(v_kids)
                                    || ',';

                        ELSE
                            val := trim(dbms_xmldom.getnodevalue(dbms_xmldom.getfirstchild(v_child)));
                            outc := outc
                                    || '"'
                                    || dbms_xmldom.getnodename(v_child)
                                    || '":'
                                    || emit_scalar(val)
                                    || ',';

                        END IF;
                    END IF;

                END IF;

            END LOOP;

  -- trim trailing comma
            IF substr(outc, -1) = ',' THEN
                outc := substr(outc,
                               1,
                               length(outc) - 1);
            END IF;

            outc := outc
                    ||
                CASE
                    WHEN arr_mode THEN
                        ']'
                    ELSE
                        '}'
                END;
            RETURN outc;
        END;

    BEGIN
        v_xml := xmltype(c);
        v_doc := dbms_xmldom.newdomdocument(v_xml);
        v_root := dbms_xmldom.getdocumentelement(v_doc);
        v_nodes := dbms_xmldom.getchildnodes(dbms_xmldom.makenode(v_root));
        r := build_json(v_nodes);
        dbms_xmldom.freedocument(v_doc);
        RETURN r;
    END to_json;

END pck_api_xml;
/


-- sqlcl_snapshot {"hash":"d96e381feea8bcd71b7993e21c60227a82f28ec2","type":"PACKAGE_BODY","name":"PCK_API_XML","schemaName":"ODBVUE","sxml":""}