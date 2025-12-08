-- liquibase formatted sql
-- changeset ODBVUE:1765201659451 stripComments:false  logicalFilePath:feattravail\odbvue\procedures\prc_ordsify.sql
-- sqlcl_snapshot db/src/database/odbvue/procedures/prc_ordsify.sql:3b8fce91b9c7ae71314a469485d07a20acec4eff:99022cecc183b13d9af3bbec62bebb0862e1fb46:alter

CREATE OR REPLACE PROCEDURE odbvue.prc_ordsify (
    p_package      VARCHAR2 DEFAULT NULL,
    p_version_name VARCHAR2 DEFAULT NULL,
    p_silent_mode  BOOLEAN DEFAULT FALSE
) AS

    v_schema_name     VARCHAR2(30 CHAR);
    v_is_ords_enabled PLS_INTEGER;
    v_module          VARCHAR2(30 CHAR);
    v_role            VARCHAR2(30 CHAR);
    v_privilege       VARCHAR2(30 CHAR);
    v_method          VARCHAR2(30 CHAR);
    v_pattern         VARCHAR2(2000 CHAR);
    v_params          VARCHAR2(2000 CHAR);
    v_argument        VARCHAR2(30 CHAR);
    v_type            VARCHAR2(30 CHAR);
    v_comment         VARCHAR2(2000 CHAR);

    PROCEDURE log (
        p VARCHAR2
    ) AS
    BEGIN
        IF NOT p_silent_mode THEN
            dbms_output.put_line(p);
        END IF;
    END;

    FUNCTION get_comment (
        p_package   IN VARCHAR2,
        p_procedure IN VARCHAR2,
        p_argument  IN VARCHAR2,
        p_overload  IN PLS_INTEGER DEFAULT 1
    ) RETURN VARCHAR2 AS
        TYPE t_lines IS
            TABLE OF PLS_INTEGER;
        v_lines t_lines;
        v_text  VARCHAR2(2000 CHAR);
    BEGIN
        IF p_package IS NULL THEN
            RETURN NULL;
        END IF;
        IF p_procedure IS NULL THEN
            SELECT
                CASE
                    WHEN text LIKE '%--%' THEN
                        replace(
                            trim(substr(text,
                                        instr(text, '--') + 2)),
                            chr(10),
                            ''
                        )
                    ELSE
                        NULL
                END
            INTO v_text
            FROM
                user_source
            WHERE
                    type = 'PACKAGE'
                AND name = upper(trim(p_package))
                AND replace(
                    upper(trim(text)),
                    ' ',
                    ''
                ) LIKE '%PACKAGE'
                       || upper(trim(p_package))
                       || '%';

            RETURN v_text;
        END IF;

        SELECT
            line
        BULK COLLECT
        INTO v_lines
        FROM
            user_source
        WHERE
                type = 'PACKAGE'
            AND name = upper(trim(p_package))
            AND replace(
                trim(upper(text)),
                ' ',
                ''
            ) LIKE 'PROCEDURE'
                   || upper(trim(p_procedure))
                   || '%'
        ORDER BY
            line;

        IF p_argument IS NULL THEN
            SELECT
                CASE
                    WHEN text LIKE '%--%' THEN
                        replace(
                            trim(substr(text,
                                        instr(text, '--') + 2)),
                            chr(10),
                            ''
                        )
                    ELSE
                        NULL
                END
            INTO v_text
            FROM
                user_source
            WHERE
                    type = 'PACKAGE'
                AND name = upper(trim(p_package))
                AND line = v_lines(coalesce(p_overload, 1));

            RETURN v_text;
        END IF;

        BEGIN
            SELECT
                CASE
                    WHEN text LIKE '%--%' THEN
                        replace(
                            trim(substr(text,
                                        instr(text, '--') + 2)),
                            chr(10),
                            ''
                        )
                    ELSE
                        NULL
                END
            INTO v_text
            FROM
                user_source
            WHERE
                    type = 'PACKAGE'
                AND name = upper(trim(p_package))
                AND replace(
                    trim(upper(text)),
                    ' ',
                    ''
                ) LIKE upper(trim(p_argument))
                       || '%'
                AND line > v_lines(coalesce(p_overload, 1))
            ORDER BY
                line
            FETCH FIRST 1 ROWS ONLY;

        EXCEPTION
            WHEN no_data_found THEN
                v_text := NULL;
        END;

        RETURN v_text;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN NULL;
    END;

BEGIN
    log('Begin setup of ORDS services');
    SELECT
        lower(sys_context('userenv', 'current_schema'))
    INTO v_schema_name
    FROM
        dual;

    log('Schema: ' || v_schema_name);

    -- Enable schema 
    SELECT
        COUNT(id)
    INTO v_is_ords_enabled
    FROM
        user_ords_schemas
    WHERE
            parsing_schema = upper(v_schema_name)
        AND status = 'ENABLED';

    IF ( v_is_ords_enabled = 0 ) THEN
        ords.enable_schema(
            p_enabled             => TRUE,
            p_schema              => v_schema_name,
            p_url_mapping_type    => 'BASE_PATH',
            p_url_mapping_pattern => lower(v_schema_name),
            p_auto_rest_auth      => FALSE
        );

        COMMIT;
        log('ORDS enabled for schema');
    END IF;    

-- modules

    FOR m IN (
        SELECT
            o.object_name
        FROM
            all_objects o
        WHERE
                owner = upper(v_schema_name)
            AND o.object_type = 'PACKAGE'
            AND ( ( p_package IS NULL )
                  OR ( upper(p_package) = o.object_name ) )
            AND EXISTS (
                SELECT
                    p.procedure_name
                FROM
                    all_procedures p
                WHERE
                        p.owner = upper(v_schema_name)
                    AND p.object_name = o.object_name
                    AND ( p.procedure_name LIKE 'GET_%'
                          OR p.procedure_name LIKE 'POST_%'
                          OR p.procedure_name LIKE 'PUT_%'
                          OR p.procedure_name LIKE 'DELETE_%' )
            )
    ) LOOP
        v_module := lower(replace(
            CASE
                WHEN substr(m.object_name, 1, 4) = 'PCK_' THEN
                    substr(m.object_name, 5)
                ELSE
                    m.object_name
            END
            ||
            CASE
                WHEN p_version_name IS NOT NULL THEN
                    '-' || p_version_name
                ELSE
                    ''
            END,
            '_',
            '-'));

        log('');
        log('Creating module: ' || v_module);
        v_comment := get_comment(m.object_name, NULL, NULL);
        ords.define_module(
            p_module_name    => v_module,
            p_base_path      => v_module || '/',
            p_items_per_page => 0,
            p_comments       => v_comment
        );

        -- methods

        FOR p IN (
            SELECT
                o.procedure_name,
                o.overload
            FROM
                all_procedures o
            WHERE
                    o.object_name = m.object_name
                AND o.procedure_name IS NOT NULL
                AND o.owner = upper(v_schema_name)
            ORDER BY
                o.subprogram_id
        ) LOOP
            v_method :=
                CASE
                    WHEN p.procedure_name LIKE 'POST_%' THEN
                        'POST'
                    WHEN p.procedure_name LIKE 'PUT_%' THEN
                        'PUT'
                    WHEN p.procedure_name LIKE 'DELETE_%' THEN
                        'DELETE'
                    WHEN p.procedure_name LIKE 'GET_%' THEN
                        'GET'
                    ELSE
                        NULL
                END;

            IF v_method IS NOT NULL THEN
                v_params := '';
                v_pattern := '';
                FOR a IN (
                    SELECT
                        argument_name,
                        defaulted,
                        in_out
                    FROM
                        all_arguments a
                    WHERE
                            package_name = m.object_name
                        AND object_name = p.procedure_name
                        AND nvl(a.overload, '0') = nvl(p.overload, '0')
                        AND owner = upper(v_schema_name)
                    ORDER BY
                        position
                ) LOOP
                    v_argument :=
                        CASE
                            WHEN substr(a.argument_name, 1, 2) IN ( 'P_', 'R_' ) THEN
                                substr(
                                    lower(a.argument_name),
                                    3
                                )
                            ELSE
                                lower(a.argument_name)
                        END;

                    v_params := v_params
                                || lower(a.argument_name)
                                || ' => :'
                                || replace(v_argument, '_', '-')
                                || ',';

                    IF a.defaulted = 'N' THEN
                        IF a.in_out = 'IN' THEN
                            v_pattern := v_pattern
                                         || ':'
                                         || replace(v_argument, '_', '-')
                                         || '/';

                        END IF;
                    END IF;

                END LOOP;

                v_params := substr(v_params,
                                   1,
                                   length(v_params) - 1);
                IF ( length(v_params) > 0 ) THEN
                    v_params := '('
                                || v_params
                                || ')';
                END IF;

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
                    '_',
                    '-'
                ))
                             || '/'
                             ||
                    CASE
                        WHEN v_method = 'GET' THEN
                            v_pattern
                        ELSE
                            NULL
                    END;

                v_comment := get_comment(m.object_name, p.procedure_name, NULL, p.overload);

                log('  Creating endpoint: '
                    || v_method
                    || ' ' || v_pattern);
                ords.define_template(
                    p_module_name => v_module,
                    p_pattern     => v_pattern,
                    p_comments    => v_comment
                );

                COMMIT;
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

                COMMIT;
                FOR a IN (
                    SELECT
                        argument_name,
                        defaulted,
                        in_out,
                        data_type
                    FROM
                        all_arguments a
                    WHERE
                            package_name = m.object_name
                        AND object_name = p.procedure_name
                        AND nvl(a.overload, '0') = nvl(p.overload, '0')
                        AND owner = upper(v_schema_name)
                    ORDER BY
                        position
                ) LOOP
                    v_argument :=
                        CASE
                            WHEN substr(a.argument_name, 1, 2) IN ( 'P_', 'R_' ) THEN
                                substr(
                                    lower(a.argument_name),
                                    3
                                )
                            ELSE
                                lower(a.argument_name)
                        END;

                    -- https://docs.oracle.com/en/database/oracle/oracle-rest-data-services/18.3/aelig/ords-database-type-mappings.html#GUID-4F7FA58A-1C29-4B7E-819F-21DB4B68FFE1
                    v_type :=
                        CASE a.data_type -- The native type of the parameter. Valid values: STRING, INT, DOUBLE, BOOLEAN, LONG, TIMESTAMP
                            WHEN 'REF CURSOR'     THEN
                                'RESULTSET'
                            WHEN 'BINARY_INTEGER' THEN
                                'INT'
                            ELSE
                                'STRING'
                        END;

                    IF a.argument_name NOT IN ( 'P_BODY' ) THEN
                        v_comment := get_comment(m.object_name, p.procedure_name, a.argument_name, p.overload);

                        ords.define_parameter(
                            p_module_name        => v_module,
                            p_pattern            => v_pattern,
                            p_method             => v_method,
                            p_name               => v_argument,
                            p_bind_variable_name => replace(v_argument, '_', '-'),
                            p_source_type        =>
                                           CASE a.in_out
                                               WHEN 'OUT' THEN
                                                   'RESPONSE'
                                               ELSE
                                                   'HEADER'
                                           END,
                            p_param_type         => v_type,
                            p_access_method      => a.in_out,
                            p_comments           => v_comment
                        );

                        COMMIT;
                    END IF;

                END LOOP;

            END IF;

        END LOOP;

    END LOOP;

    -- done

    log('');
    log('Success!');
END;
/

