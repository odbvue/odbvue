create or replace procedure odbvue.prc_ordsify (
    p_package      varchar2 default null,
    p_version_name varchar2 default null,
    p_silent_mode  boolean default false
) as

    v_schema_name     varchar2(30 char);
    v_is_ords_enabled pls_integer;
    v_module          varchar2(30 char);
    v_role            varchar2(30 char);
    v_privilege       varchar2(30 char);
    v_method          varchar2(30 char);
    v_pattern         varchar2(2000 char);
    v_params          varchar2(2000 char);
    v_argument        varchar2(30 char);
    v_type            varchar2(30 char);
    v_comment         varchar2(2000 char);

    procedure log (
        p varchar2
    ) as
    begin
        if not p_silent_mode then
            dbms_output.put_line(p);
        end if;
    end;

    function get_comment (
        p_package   in varchar2,
        p_procedure in varchar2,
        p_argument  in varchar2,
        p_overload  in pls_integer default 1
    ) return varchar2 as
        type t_lines is
            table of pls_integer;
        v_lines t_lines;
        v_text  varchar2(2000 char);
    begin
        if p_package is null then
            return null;
        end if;
        if p_procedure is null then
            select
                case
                    when text like '%--%' then
                        replace(
                            trim(substr(text,
                                        instr(text, '--') + 2)),
                            chr(10),
                            ''
                        )
                    else
                        null
                end
            into v_text
            from
                user_source
            where
                    type = 'PACKAGE'
                and name = upper(trim(p_package))
                and replace(
                    upper(trim(text)),
                    ' ',
                    ''
                ) like '%PACKAGE'
                       || upper(trim(p_package))
                       || '%';

            return v_text;
        end if;

        select
            line
        bulk collect
        into v_lines
        from
            user_source
        where
                type = 'PACKAGE'
            and name = upper(trim(p_package))
            and replace(
                trim(upper(text)),
                ' ',
                ''
            ) like 'PROCEDURE'
                   || upper(trim(p_procedure))
                   || '%'
        order by
            line;

        if p_argument is null then
            select
                case
                    when text like '%--%' then
                        replace(
                            trim(substr(text,
                                        instr(text, '--') + 2)),
                            chr(10),
                            ''
                        )
                    else
                        null
                end
            into v_text
            from
                user_source
            where
                    type = 'PACKAGE'
                and name = upper(trim(p_package))
                and line = v_lines(coalesce(p_overload, 1));

            return v_text;
        end if;

        begin
            select
                case
                    when text like '%--%' then
                        replace(
                            trim(substr(text,
                                        instr(text, '--') + 2)),
                            chr(10),
                            ''
                        )
                    else
                        null
                end
            into v_text
            from
                user_source
            where
                    type = 'PACKAGE'
                and name = upper(trim(p_package))
                and replace(
                    trim(upper(text)),
                    ' ',
                    ''
                ) like upper(trim(p_argument))
                       || '%'
                and line > v_lines(coalesce(p_overload, 1))
            order by
                line
            fetch first 1 rows only;

        exception
            when no_data_found then
                v_text := null;
        end;

        return v_text;
    exception
        when others then
            return null;
    end;

begin
    log('Begin setup of ORDS services');
    select
        lower(sys_context('userenv', 'current_schema'))
    into v_schema_name
    from
        dual;

    log('Schema: ' || v_schema_name);

    -- Enable schema 
    select
        count(id)
    into v_is_ords_enabled
    from
        user_ords_schemas
    where
            parsing_schema = upper(v_schema_name)
        and status = 'ENABLED';

    if ( v_is_ords_enabled = 0 ) then
        ords.enable_schema(
            p_enabled             => true,
            p_schema              => v_schema_name,
            p_url_mapping_type    => 'BASE_PATH',
            p_url_mapping_pattern => v_schema_name,
            p_auto_rest_auth      => false
        );

        commit;
        log('ORDS enabled for schema');
    end if;    

-- modules

    for m in (
        select
            o.object_name
        from
            all_objects o
        where
                owner = upper(v_schema_name)
            and o.object_type = 'PACKAGE'
            and ( ( p_package is null )
                  or ( upper(p_package) = o.object_name ) )
            and exists (
                select
                    p.procedure_name
                from
                    all_procedures p
                where
                        p.owner = upper(v_schema_name)
                    and p.object_name = o.object_name
                    and ( p.procedure_name like 'GET_%'
                          or p.procedure_name like 'POST_%'
                          or p.procedure_name like 'PUT_%'
                          or p.procedure_name like 'DELETE_%' )
            )
    ) loop
        v_module := lower(replace(
            case
                when substr(m.object_name, 1, 4) = 'PCK_' then
                    substr(m.object_name, 5)
                else
                    m.object_name
            end
            ||
            case
                when p_version_name is not null then
                    '-' || p_version_name
                else
                    ''
            end,
            '_',
            '-'));

        log('');
        log('Creating module: ' || v_module);
        v_comment := get_comment(m.object_name, null, null);
        ords.define_module(
            p_module_name    => v_module,
            p_base_path      => v_module || '/',
            p_items_per_page => 0,
            p_comments       => v_comment
        );

        for p in (
            select
                o.procedure_name,
                o.overload
            from
                all_procedures o
            where
                    o.object_name = m.object_name
                and o.procedure_name is not null
                and o.owner = upper(v_schema_name)
            order by
                o.subprogram_id
        ) loop
            v_method :=
                case
                    when p.procedure_name like 'POST_%' then
                        'POST'
                    when p.procedure_name like 'PUT_%' then
                        'PUT'
                    when p.procedure_name like 'DELETE_%' then
                        'DELETE'
                    when p.procedure_name like 'GET_%' then
                        'GET'
                    else
                        null
                end;

            if v_method is not null then
                v_params := '';
                v_pattern := '';
                for a in (
                    select
                        argument_name,
                        defaulted,
                        in_out
                    from
                        all_arguments
                    where
                            package_name = m.object_name
                        and object_name = p.procedure_name
                        and overload = p.overload
                        and owner = upper(v_schema_name)
                    order by
                        position
                ) loop
                    v_argument :=
                        case
                            when substr(a.argument_name, 1, 2) in ( 'P_', 'R_' ) then
                                substr(
                                    lower(a.argument_name),
                                    3
                                )
                            else
                                lower(a.argument_name)
                        end;

                    v_params := v_params
                                || lower(a.argument_name)
                                || ' => :'
                                || v_argument
                                || ',';

                    if a.defaulted = 'N' then
                        if a.in_out = 'IN' then
                            v_pattern := v_pattern
                                         || ':'
                                         || v_argument
                                         || '/';
                        end if;
                    end if;

                end loop;

                v_params := substr(v_params,
                                   1,
                                   length(v_params) - 1);
                if ( length(v_params) > 0 ) then
                    v_params := '('
                                || v_params
                                || ')';
                end if;

                v_pattern := substr(v_pattern,
                                    1,
                                    length(v_pattern) - 1);
                v_pattern := lower(replace(
                    replace(
                        replace(
                            replace(
                                replace(p.procedure_name, 'POST_'),
                                'GET_'
                            ),
                            'PUT_'
                        ),
                        'DELETE_'
                    ),
                    '_TOKEN'
                ))
                             || '/'
                             ||
                    case
                        when v_method = 'GET' then
                            v_pattern
                        else
                            null
                    end;

                v_comment := get_comment(m.object_name, p.procedure_name, null, p.overload);

                log('  Creating endpoint: '
                    || v_method
                    || ' ' || v_pattern);
                ords.define_template(
                    p_module_name => v_module,
                    p_pattern     => v_pattern,
                    p_comments    => v_comment
                );

                commit;
                ords.define_handler(
                    p_module_name    => v_module,
                    p_pattern        => v_pattern,
                    p_method         => v_method,
                    p_source_type    => ords.source_type_plsql,
                    p_source         => 'BEGIN '
                                || lower(m.object_name)
                                || '.'
                                || lower(p.procedure_name)
                                || ''
                                || v_params
                                || '; END;',
                    p_items_per_page => 0,
                    p_comments       => v_comment
                );

                commit;
                for a in (
                    select
                        argument_name,
                        defaulted,
                        in_out,
                        data_type
                    from
                        all_arguments
                    where
                            package_name = m.object_name
                        and object_name = p.procedure_name
                        and overload = p.overload
                        and owner = upper(v_schema_name)
                    order by
                        position
                ) loop
                    v_argument :=
                        case
                            when substr(a.argument_name, 1, 2) in ( 'P_', 'R_' ) then
                                substr(
                                    lower(a.argument_name),
                                    3
                                )
                            else
                                lower(a.argument_name)
                        end;

                    -- https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/18.3/aelig/ords-database-type-mappings.html#GUID-4F7FA58A-1C29-4B7E-819F-21DB4B68FFE1
                    v_type :=
                        case a.data_type -- The native type of the parameter. Valid values: STRING, INT, DOUBLE, BOOLEAN, LONG, TIMESTAMP
                            when 'REF CURSOR'     then
                                'RESULTSET'
                            when 'BINARY_INTEGER' then
                                'INT'
                            else
                                'STRING'
                        end;

                    if a.argument_name not in ( 'P_BODY' ) then
                        v_comment := get_comment(m.object_name, p.procedure_name, a.argument_name, p.overload);

                        ords.define_parameter(
                            p_module_name        => v_module,
                            p_pattern            => v_pattern,
                            p_method             => v_method,
                            p_name               => v_argument,
                            p_bind_variable_name => v_argument,
                            p_source_type        =>
                                           case a.in_out
                                               when 'OUT' then
                                                   'RESPONSE'
                                               else
                                                   'HEADER'
                                           end,
                            p_param_type         => v_type,
                            p_access_method      => a.in_out,
                            p_comments           => v_comment
                        );

                        commit;
                    end if;

                end loop;

            end if;

        end loop;

    end loop;

    -- done

    log('');
    log('Success!');
end;
/


-- sqlcl_snapshot {"hash":"d1a92156190dbcbbc868e065bade0a4ab17cf973","type":"PROCEDURE","name":"PRC_ORDSIFY","schemaName":"ODBVUE","sxml":""}