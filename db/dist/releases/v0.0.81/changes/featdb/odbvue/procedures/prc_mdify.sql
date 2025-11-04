-- liquibase formatted sql
-- changeset ODBVUE:1762266058227c stripComments:false  logicalFilePath:featdb\odbvue\procedures\prc_mdify.sql
-- sqlcl_snapshot db/src/database/odbvue/procedures/prc_mdify.sql:null:bf87b0e5c2a14a853c9584bb54d0f41ca84d9c01:create

create or replace procedure odbvue.prc_mdify (
    p_object in varchar2
) as

    v_schema_name varchar2(30) := user;
    v_object_name varchar2(128 char);
    v_object_type varchar2(128 char);
    v_editionable char(1 char);
    v_overload    pls_integer;
    lf            varchar2(2) := chr(10);
    v             varchar2(2000 char);
    n             pls_integer;
    r             clob;

    procedure line (
        p varchar2 default ''
    ) as
    begin
        r := r
             || p
             || lf;
    end;

    procedure list_item (
        key varchar2,
        val varchar2
    ) as
    begin
        r := r
             || '- '
             || key
             || ': **'
             || val
             || '**'
             || lf;
    end;

    procedure print as

        v_offset       pls_integer := 1;
        v_line         varchar2(32767);
        v_total_length pls_integer := length(r);
        v_line_length  pls_integer;
    begin
        while v_offset <= v_total_length loop
            v_line_length := instr(r,
                                   chr(10),
                                   v_offset) - v_offset;
            if v_line_length < 0 then
                v_line_length := v_total_length + 1 - v_offset;
            end if;
            v_line := substr(r, v_offset, v_line_length);
            dbms_output.put_line(v_line);
            v_offset := v_offset + v_line_length + 1;
        end loop;
    end;

begin

-- PACKAGES

    select
        count(*)
    into n
    from
        all_procedures up
    where
        up.procedure_name is null
        and up.object_type = 'PACKAGE'
        and up.owner = v_schema_name
        and ( p_object is null
              or up.object_name = upper(p_object) );

    if n > 0 then

/*
    line('## Packages');
    line();

    line('### Summary');
    line();

    line('| Package name | Description |');
    line('| ------------ | ----------- |');

    FOR c IN (
      SELECT 
        up.object_name AS package_name,
        (
          SELECT 
            REPLACE(REPLACE(TRIM(REPLACE(SUBSTR(s.text,INSTR(s.text,'--',1)),'--','')),CHR(13),''),CHR(10),'') 
          FROM all_source s
          WHERE name = up.object_name
          AND type = 'PACKAGE'
          AND (UPPER(s.text)LIKE '%PACKAGE%')
          AND (UPPER(s.text) NOT LIKE '%BODY%')
          AND s.text LIKE '%--%'
          AND rownum = 1
          AND s.owner = v_schema_name
        ) AS comments
      FROM all_procedures up
      WHERE up.procedure_name IS NULL
      AND up.object_type = 'PACKAGE'
      AND up.owner = v_schema_name
      ORDER BY package_name
    ) LOOP 
      line('|' || c.package_name || '|' || c.comments || '|');
    END LOOP;

    line('');
*/
    -- PACKAGE - DETAILS

        for c in (
            select
                up.object_name as package_name,
                (
                    select
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
                    from
                        all_source s
                    where
                            name = up.object_name
                        and type = 'PACKAGE'
                        and ( upper(s.text) like '%PACKAGE%' )
                        and ( upper(s.text) not like '%BODY%' )
                        and s.text like '%--%'
                        and rownum = 1
                        and s.owner = v_schema_name
                )              as comments
            from
                all_procedures up
            where
                up.procedure_name is null
                and up.object_type = 'PACKAGE'
                and up.owner = v_schema_name
                and ( p_object is null
                      or up.object_name = upper(p_object) )
            order by
                package_name
        ) loop
            line('# '
                 || c.package_name || '');
            line();
            line(c.comments);
            line();   

      -- Package dependencies

            select
                count(*)
            into n
            from
                all_dependencies d
            where
                    d.owner = v_schema_name
                and d.referenced_owner = v_schema_name
                and d.type = 'PACKAGE'
                and d.name = c.package_name;

            if n > 0 then
                line('Dependencies:');
                line();
                line('| Referenced type | Referenced name |');
                line('| --------------- | --------------- |');
                for c4 in (
                    select
                        d.referenced_type,
                        d.referenced_name
                    from
                        all_dependencies d
                    where
                            d.owner = v_schema_name
                        and d.referenced_owner = v_schema_name
                        and d.type = 'PACKAGE'
                        and d.name = c.package_name
                ) loop
                    line('|'
                         || c4.referenced_type
                         || '|'
                         || c4.referenced_name || '|');
                end loop;

                line();
            end if;

      -- Package routines

            for c2 in (
                select
                    o.procedure_name,
                    o.overload,
                    (
                        select
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
                        from
                            all_source s
                        where
                                name = o.object_name
                            and type = 'PACKAGE'
                            and ( ( ( upper(s.text) like '%PROCEDURE%' )
                                    or ( upper(s.text) like '%FUNCTION%' ) )
                                  and ( upper(s.text) like '% '
                                                           || upper(o.procedure_name)
                                                           || ' %'
                                        or upper(s.text) like '% '
                                        || upper(o.procedure_name)
                                        || '(%'
                                           or upper(s.text) like '% '
                                                                 || upper(o.procedure_name)
                                                                 || ';%' ) )
                            and s.text like '%--%'
                            and rownum = 1
                            and s.owner = v_schema_name
                    ) as comments
                from
                    all_procedures o
                where
                        o.object_name = c.package_name
                    and o.object_name is not null
                    and o.procedure_name is not null
                    and o.owner = v_schema_name
            ) loop
                line('## ' || c2.procedure_name);
                line();
                line(c2.comments);
                line();
                select
                    count(*)
                into n
                from
                    all_arguments a
                where
                        a.package_name = c.package_name
                    and a.object_name = c2.procedure_name
                    and ( overload is null
                          or overload = c2.overload )
                    and a.owner = v_schema_name;

                if n > 0 then
                    line('| Argument name | In Out | Data type | Default value | Description |');
                    line('| ------------- | ------ | --------- | ------------- | ----------- |');
                    for c3 in (
                        select
                            argument_name,
                            data_type,
                            in_out,
                            (
                                select
                                    regexp_replace(
                                        regexp_substr(s.text, 'DEFAULT\s+(\S+)', 1, 1, null,
                                                      1),
                                        ',$',
                                        ''
                                    )
                                from
                                    all_source s
                                where
                                        name = package_name
                                    and type = 'PACKAGE'
                                    and s.owner = v_schema_name
                                    and ( ( ( argument_name is not null )
                                            and ( instr(
                                        upper(text),
                                        argument_name
                                    ) > 0 ) )
                                          or ( ( argument_name is null )
                                               and ( instr(
                                        upper(text),
                                        ')'
                                    ) > 0 )
                                               and ( instr(
                                        upper(text),
                                        'RETURN'
                                    ) > 0 )
                                               and ( instr(
                                        upper(text),
                                        ';'
                                    ) > 0 ) ) )
                                    and line > (
                                        select
                                            min(line)
                                        from
                                            all_source
                                        where
                                            ( ( ( instr(
                                                upper(text),
                                                'PROCEDURE'
                                            ) > 0 )
                                                or ( instr(
                                                upper(text),
                                                'FUNCTION'
                                            ) > 0 ) )
                                              and ( instr(
                                                upper(text),
                                                upper(object_name)
                                            ) > 0 ) )
                                            and owner = v_schema_name
                                    )
                                    and s.text like '%--%'
                                    and rownum = 1
                            ) as default_value,
                            (
                                select
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
                                from
                                    all_source s
                                where
                                        name = package_name
                                    and type = 'PACKAGE'
                                    and s.owner = v_schema_name
                                    and ( ( ( argument_name is not null )
                                            and ( instr(
                                        upper(text),
                                        argument_name
                                    ) > 0 ) )
                                          or ( ( argument_name is null )
                                               and ( instr(
                                        upper(text),
                                        ')'
                                    ) > 0 )
                                               and ( instr(
                                        upper(text),
                                        'RETURN'
                                    ) > 0 )
                                               and ( instr(
                                        upper(text),
                                        ';'
                                    ) > 0 ) ) )
                                    and line > (
                                        select
                                            min(line)
                                        from
                                            all_source
                                        where
                                            ( ( ( instr(
                                                upper(text),
                                                'PROCEDURE'
                                            ) > 0 )
                                                or ( instr(
                                                upper(text),
                                                'FUNCTION'
                                            ) > 0 ) )
                                              and ( instr(
                                                upper(text),
                                                upper(object_name)
                                            ) > 0 ) )
                                            and owner = v_schema_name
                                    )
                                    and s.text like '%--%'
                                    and rownum = 1
                            ) as comments
                        from
                            all_arguments
                        where
                                package_name = c.package_name
                            and object_name = c2.procedure_name
                            and ( overload is null
                                  or overload = c2.overload )
                            and owner = v_schema_name
                        order by
                            position
                    ) loop
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
                    end loop;

                    line();
                end if;

            end loop;

        end loop;

    end if;

    print;
end;
/

