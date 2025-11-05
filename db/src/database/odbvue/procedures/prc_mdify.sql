CREATE OR REPLACE PROCEDURE odbvue.prc_mdify ( -- Procedure generates markdown database documentation for current schema
    p_filter IN VARCHAR2, -- e.g. PACKAGE=pck_api_lob
    p_title IN VARCHAR2 DEFAULT NULL -- e.g. 'Large Binary Objects',
) AS

    v_schema_name VARCHAR2(30) := user;
    v_object_name VARCHAR2(128 CHAR);
    v_object_type VARCHAR2(128 CHAR);
    v_object_count PLS_INTEGER;
    v_editionable CHAR(1 CHAR);
    v_overload    PLS_INTEGER;
    lf            VARCHAR2(2) := chr(10);
    v             VARCHAR2(2000 CHAR);
    n             PLS_INTEGER;
    r             CLOB;

    PROCEDURE line (
        p VARCHAR2 DEFAULT '',
        i PLS_INTEGER DEFAULT 0
    ) AS
    BEGIN
        r := r
            || CASE
                WHEN v_object_count > 1 AND i > 0 THEN '#' 
                ELSE '' 
                END 
            || CASE (i - 1) 
               WHEN 1 THEN '# ' 
               WHEN 2 THEN '## ' 
               WHEN 3 THEN '### ' 
               WHEN 4 THEN '#### ' 
               ELSE '' 
               END
            || p
            || lf;
    END;

    PROCEDURE list_item (
        key VARCHAR2,
        val VARCHAR2
    ) AS
    BEGIN
        r := r
             || '- '
             || key
             || ': **'
             || val
             || '**'
             || lf;
    END;

    PROCEDURE print AS

        v_offset       PLS_INTEGER := 1;
        v_line         VARCHAR2(32767);
        v_total_length PLS_INTEGER := length(r);
        v_line_length  PLS_INTEGER;
    BEGIN
        WHILE v_offset <= v_total_length LOOP
            v_line_length := instr(r,
                                   chr(10),
                                   v_offset) - v_offset;
            IF v_line_length < 0 THEN
                v_line_length := v_total_length + 1 - v_offset;
            END IF;
            v_line := substr(r, v_offset, v_line_length);
            dbms_output.put_line(v_line);
            v_offset := v_offset + v_line_length + 1;
        END LOOP;
    END;

BEGIN

    v_schema_name := user;

    if ( p_filter IS NOT NULL AND instr(p_filter,'=') > 0 ) then
        v_object_type := substr(p_filter,1,instr(p_filter,'=')-1);
        v_object_name := substr(p_filter,instr(p_filter,'=')+1);
    END IF;

    -- PACKAGES

    SELECT
        COUNT(up.object_name)
    INTO 
        v_object_count
    FROM
        all_procedures up
    WHERE
        up.owner = v_schema_name
        AND up.procedure_name IS NULL
        AND ( v_object_type IS NULL
            OR up.object_type = 'PACKAGE' )
        AND ( v_object_name IS NULL
            OR up.object_name = upper(v_object_name) )
            ;

    IF v_object_count > 1 THEN 
        line('Packages', 1);
        line;
    END IF;

    FOR c IN (
        SELECT
            object_name AS package_name,
                    (
                    SELECT
                        replace(
                            replace(
                                trim(replace(
                                    substr(s.text,
                                           instr(s.text, '--', 1)),
                                    '--',
                                    ''
                                )),
                                chr(13),
                                ''
                            ),
                            chr(10),
                            ''
                        )
                    FROM
                        all_source s
                    WHERE
                            name = up.object_name
                        AND type = 'PACKAGE'
                        AND ( upper(s.text) LIKE '%PACKAGE%' )
                        AND ( upper(s.text) NOT LIKE '%BODY%' )
                        AND s.text LIKE '%--%'
                        AND ROWNUM = 1
                        AND s.owner = v_schema_name
                )              AS comments
        FROM
            all_procedures up
        WHERE
            up.owner = v_schema_name
            AND up.procedure_name IS NULL
            AND ( v_object_type IS NULL
                OR up.object_type = 'PACKAGE' )
            AND ( v_object_name IS NULL
                OR up.object_name = upper(v_object_name) )
    ) LOOP

        line(COALESCE(p_title,c.package_name), 2);
        line;

        line(c.comments);
        line;

        line('::: details example');
        line('<<< ../../../../../db/src/database/odbvue/tests/' || LOWER(c.package_name) || '.sql');
        line(':::');
        line;

        line('::: details specification');
        line('<<< ../../../../../db/src/database/odbvue/package_specs/' || LOWER(c.package_name) || '.sql');
        line(':::');
        line;

        line('::: details implementation');
        line('<<< ../../../../../db/src/database/odbvue/package_bodies/' || LOWER(c.package_name) || '.sql');
        line(':::');
        line;

      -- Package dependencies

        SELECT
            COUNT(*)
        INTO n
        FROM
            all_dependencies d
        WHERE
                d.owner = v_schema_name
            AND d.referenced_owner = v_schema_name
            AND d.type = 'PACKAGE'
            AND d.name = c.package_name;

        IF n > 0 THEN
            line('Dependencies:');
            line();
            line('| Referenced type | Referenced name |');
            line('| --------------- | --------------- |');
            FOR c4 IN (
                SELECT
                    d.referenced_type,
                    d.referenced_name
                FROM
                    all_dependencies d
                WHERE
                        d.owner = v_schema_name
                    AND d.referenced_owner = v_schema_name
                    AND d.type = 'PACKAGE'
                    AND d.name = c.package_name
            ) LOOP
                line('|'
                        || c4.referenced_type
                        || '|'
                        || c4.referenced_name || '|');
            END LOOP;

            line();
        END IF;

        -- Package routines

        FOR c2 IN (
            SELECT
                o.procedure_name,
                o.overload,
                (
                    SELECT
                        replace(
                            replace(
                                trim(replace(
                                    substr(s.text,
                                            instr(s.text, '--', 1)),
                                    '--',
                                    ''
                                )),
                                chr(13),
                                ''
                            ),
                            chr(10),
                            ''
                        )
                    FROM
                        all_source s
                    WHERE
                            name = o.object_name
                        AND type = 'PACKAGE'
                        AND ( ( ( upper(s.text) LIKE '%PROCEDURE%' )
                                OR ( upper(s.text) LIKE '%FUNCTION%' ) )
                                AND ( upper(s.text) LIKE '% '
                                                        || upper(o.procedure_name)
                                                        || ' %'
                                    OR upper(s.text) LIKE '% '
                                    || upper(o.procedure_name)
                                    || '(%'
                                        OR upper(s.text) LIKE '% '
                                                                || upper(o.procedure_name)
                                                                || ';%' ) )
                        AND s.text LIKE '%--%'
                        AND ROWNUM = 1
                        AND s.owner = v_schema_name
                ) AS comments
            FROM
                all_procedures o
            WHERE
                    o.object_name = c.package_name
                AND o.object_name IS NOT NULL
                AND o.procedure_name IS NOT NULL
                AND o.owner = v_schema_name
        ) LOOP
            line(c2.procedure_name, 3);
            line();
            line(c2.comments);
            line();
            
            SELECT
                COUNT(*)
            INTO n
            FROM
                all_arguments a
            WHERE
                    a.package_name = c.package_name
                AND a.object_name = c2.procedure_name
                AND ( overload IS NULL
                        OR overload = c2.overload )
                AND a.owner = v_schema_name;

            IF n > 0 THEN
                line('| Argument name | In Out | Data type | Default value | Description |');
                line('| ------------- | ------ | --------- | ------------- | ----------- |');
                FOR c3 IN (
                    SELECT
                        argument_name,
                        data_type,
                        in_out,
                        (
                            SELECT
                                regexp_replace(
                                    regexp_substr(s.text, 'DEFAULT\s+(\S+)', 1, 1, NULL,
                                                    1),
                                    ',$',
                                    ''
                                )
                            FROM
                                all_source s
                            WHERE
                                    name = package_name
                                AND type = 'PACKAGE'
                                AND s.owner = v_schema_name
                                AND ( ( ( argument_name IS NOT NULL )
                                        AND ( instr(
                                    upper(text),
                                    argument_name
                                ) > 0 ) )
                                        OR ( ( argument_name IS NULL )
                                            AND ( instr(
                                    upper(text),
                                    ')'
                                ) > 0 )
                                            AND ( instr(
                                    upper(text),
                                    'RETURN'
                                ) > 0 )
                                            AND ( instr(
                                    upper(text),
                                    ';'
                                ) > 0 ) ) )
                                AND line > (
                                    SELECT
                                        MIN(line)
                                    FROM
                                        all_source
                                    WHERE
                                        ( ( ( instr(
                                            upper(text),
                                            'PROCEDURE'
                                        ) > 0 )
                                            OR ( instr(
                                            upper(text),
                                            'FUNCTION'
                                        ) > 0 ) )
                                            AND ( instr(
                                            upper(text),
                                            upper(object_name)
                                        ) > 0 ) )
                                        AND owner = v_schema_name
                                )
                                AND s.text LIKE '%--%'
                                AND ROWNUM = 1
                        ) AS default_value,
                        (
                            SELECT
                                replace(
                                    replace(
                                        trim(replace(
                                            substr(text,
                                                    instr(text, '--', 1)),
                                            '--',
                                            ''
                                        )),
                                        chr(13),
                                        ''
                                    ),
                                    chr(10),
                                    ''
                                )
                            FROM
                                all_source s
                            WHERE
                                    name = package_name
                                AND type = 'PACKAGE'
                                AND s.owner = v_schema_name
                                AND ( ( ( argument_name IS NOT NULL )
                                        AND ( instr(
                                    upper(text),
                                    argument_name
                                ) > 0 ) )
                                        OR ( ( argument_name IS NULL )
                                            AND ( instr(
                                    upper(text),
                                    ')'
                                ) > 0 )
                                            AND ( instr(
                                    upper(text),
                                    'RETURN'
                                ) > 0 )
                                            AND ( instr(
                                    upper(text),
                                    ';'
                                ) > 0 ) ) )
                                AND line > (
                                    SELECT
                                        MIN(line)
                                    FROM
                                        all_source
                                    WHERE
                                        ( ( ( instr(
                                            upper(text),
                                            'PROCEDURE'
                                        ) > 0 )
                                            OR ( instr(
                                            upper(text),
                                            'FUNCTION'
                                        ) > 0 ) )
                                            AND ( instr(
                                            upper(text),
                                            upper(object_name)
                                        ) > 0 ) )
                                        AND owner = v_schema_name
                                )
                                AND s.text LIKE '%--%'
                                AND ROWNUM = 1
                        ) AS comments
                    FROM
                        all_arguments
                    WHERE
                            package_name = c.package_name
                        AND object_name = c2.procedure_name
                        AND ( overload IS NULL
                                OR overload = c2.overload )
                        AND owner = v_schema_name
                    ORDER BY
                        position
                ) LOOP
                    line('|'
                            || c3.argument_name
                            || '|'
                            || c3.in_out
                            || '|'
                            || c3.data_type
                            || '|'
                            || c3.default_value
                            || '|'
                            || c3.comments || '|');
                END LOOP; -- Package Routine Arguments
                line;

            END IF;

        END LOOP; -- Package Routines

    END LOOP; -- Packages

    print;

END;
/


-- sqlcl_snapshot {"hash":"aed9d32fa6ad19b5836de5e86e310374784cff6f","type":"PROCEDURE","name":"PRC_MDIFY","schemaName":"ODBVUE","sxml":""}