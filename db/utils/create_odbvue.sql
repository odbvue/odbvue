CREATE OR REPLACE PACKAGE odbvue AS

    FUNCTION long_to_clob (
        p_owner  VARCHAR2,
        p_table  VARCHAR2,
        p_column VARCHAR2,
        p_identity VARCHAR2
    ) RETURN CLOB;

    PROCEDURE whoami;

    PROCEDURE export_schema (
        p_schema_username IN VARCHAR2
    );

    PROCEDURE import_schema (
        p_schema_username IN VARCHAR2,
        p_clob            IN CLOB
    );

END odbvue;
/

CREATE OR REPLACE PACKAGE BODY odbvue AS 

    PROCEDURE print(
        p_clob IN OUT NOCOPY CLOB
    ) IS
        l_pos  PLS_INTEGER := 1;
        l_len  PLS_INTEGER;
        l_nl   PLS_INTEGER;
    BEGIN
        IF p_clob IS NULL THEN
            RETURN;
        END IF;

        l_len := DBMS_LOB.getlength(p_clob);

        WHILE l_pos <= l_len LOOP
            l_nl := DBMS_LOB.instr(p_clob, CHR(10), l_pos);

            IF l_nl = 0 THEN
                DBMS_OUTPUT.put_line(
                    DBMS_LOB.substr(p_clob, 32767, l_pos)
                );
                EXIT;
            ELSE
                DBMS_OUTPUT.put_line(
                    DBMS_LOB.substr(p_clob, l_nl - l_pos, l_pos)
                );
                l_pos := l_nl + 1;
            END IF;
        END LOOP;
    END print;

    FUNCTION long_to_clob (
        p_owner  VARCHAR2,
        p_table  VARCHAR2,
        p_column VARCHAR2,
        p_identity VARCHAR2
    ) RETURN CLOB IS
        v_xml  CLOB;
        v_clob CLOB;
    BEGIN
        IF p_identity = 'YES' THEN
            RETURN NULL;
        END IF;
        v_xml := dbms_xmlgen.getxml('select data_default from all_tab_columns '
                                    || 'where owner = '''
                                    || replace(
            p_owner,
            '''',
            ''''''
        )
                                    || ''' '
                                    || 'and table_name = '''
                                    || replace(
            p_table,
            '''',
            ''''''
        )
                                    || ''' '
                                    || 'and column_name = '''
                                    || replace(
            p_column,
            '''',
            ''''''
        ) || '''');

        SELECT XMLCAST(XMLQUERY('/ROWSET/ROW/DATA_DEFAULT/text()'
            PASSING xmltype(v_xml)
        RETURNING CONTENT) AS CLOB)
            INTO v_clob
            FROM dual;

        RETURN v_clob;
    END long_to_clob;

    PROCEDURE whoami IS
        v_user VARCHAR2(128 CHAR);
        v_version VARCHAR2(4000 CHAR);
        v_compatibility VARCHAR2(4000 CHAR);
        v_current_edition VARCHAR2(128 CHAR);
    BEGIN
        -- select current user
        v_user := sys_context('USERENV', 'CURRENT_USER');
        dbms_output.put_line('Current user: ' || v_user);
        -- select database version
        dbms_utility.db_version(v_version, v_compatibility);
        dbms_output.put_line('Database version: ' || v_version || ' (compat: ' || v_compatibility || ')');
        -- select current edition
        v_current_edition := sys_context('USERENV', 'CURRENT_EDITION_NAME');
        dbms_output.put_line('Current edition: ' || nvl(v_current_edition, '<none>'));
    END whoami;

    PROCEDURE export_schema (
        p_schema_username IN VARCHAR2
    ) AS
        c_schema_username VARCHAR2(128 CHAR) := TRIM(UPPER(p_schema_username));
        r CLOB;
    BEGIN
        SELECT JSON_SERIALIZE(
            JSON_OBJECT(
                'schema' VALUE c_schema_username,
                'exported' VALUE SYSTIMESTAMP,
                'tables' VALUE (
                    SELECT JSON_ARRAYAGG(
                        JSON_OBJECT(
                            'name' VALUE table_name,
                            'columns' VALUE (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'name' VALUE column_name,
                                        'type' VALUE data_type || CASE 
                                            WHEN data_type IN ('CHAR', 'NCHAR', 'VARCHAR2', 'NVARCHAR2') THEN
                                                '(' || CASE 
                                                    WHEN char_used = 'C' THEN char_length
                                                    ELSE data_length
                                                END || ' CHAR)'
                                            WHEN data_type IN ('NUMBER') THEN
                                                CASE 
                                                    WHEN data_precision IS NOT NULL AND data_scale IS NOT NULL THEN
                                                        '(' || data_precision || ',' || data_scale || ')'
                                                    WHEN data_precision IS NOT NULL AND data_scale IS NULL THEN
                                                        '(' || data_precision || ')'
                                                    ELSE
                                                        ''
                                                END
                                            WHEN data_type IN ('RAW') THEN
                                                '(' || data_length || ')'
                                            WHEN data_type IN ('FLOAT') THEN
                                                '(' || data_precision || ')'
                                            ELSE
                                                ''
                                        END,
                                        'default' VALUE long_to_clob(
                                            atc.owner,
                                            atc.table_name,
                                            atc.column_name,
                                            atc.identity_column
                                        ),
                                        'nullable' VALUE CASE WHEN nullable = 'Y' THEN 'true' ELSE 'false' END FORMAT JSON,
                                        'identity' VALUE CASE WHEN identity_column = 'YES' THEN 'true' ELSE 'false' END FORMAT JSON
                                    )
                                    ORDER BY atc.column_id
                                )
                                FROM all_tab_columns atc
                                WHERE atc.owner = c_schema_username
                                  AND atc.table_name = at.table_name
                            ),
                            'primary_key' VALUE (
                                SELECT JSON_ARRAYAGG(acc.column_name ORDER BY acc.position)
                                FROM   all_constraints ac
                                JOIN   all_cons_columns acc
                                    ON ac.constraint_name = acc.constraint_name
                                WHERE  ac.table_name = at.table_name
                                    AND ac.owner = c_schema_username
                                    AND ac.constraint_type = 'P'
                                    AND acc.owner = c_schema_username
                            ),
                            'unique' VALUE (
                                SELECT JSON_ARRAYAGG(
                                    (
                                        SELECT JSON_ARRAYAGG(acc.column_name ORDER BY acc.position)
                                        FROM all_cons_columns acc
                                        WHERE acc.constraint_name = ac.constraint_name
                                    )
                                    ORDER BY ac.constraint_name
                                )
                                FROM all_constraints ac
                                WHERE ac.table_name = at.table_name
                                    AND ac.owner = c_schema_username
                                    AND ac.constraint_type = 'U'
                            ),
                            'indexes' VALUE (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'name' VALUE ai.index_name,
                                        'columns' VALUE (
                                            SELECT JSON_ARRAYAGG(aic.column_name ORDER BY aic.column_position)
                                            FROM all_ind_columns aic
                                            WHERE aic.index_name = ai.index_name
                                                AND aic.index_owner = c_schema_username
                                        ),
                                        'unique' VALUE CASE WHEN ai.uniqueness = 'UNIQUE' THEN 1 ELSE 0 END
                                    )
                                    ORDER BY ai.index_name
                                )
                                FROM all_indexes ai
                                WHERE ai.table_name = at.table_name
                                    AND ai.table_owner = c_schema_username
                                    AND ai.index_type = 'NORMAL'
                                    AND ai.generated = 'N'
                            ),
                            'foreignKeys' VALUE (
                                SELECT JSON_ARRAYAGG(
                                    JSON_OBJECT(
                                        'columns' VALUE (
                                            SELECT JSON_ARRAYAGG(acc.column_name ORDER BY acc.position)
                                            FROM all_cons_columns acc
                                            WHERE acc.constraint_name = ac.constraint_name
                                                AND acc.owner = c_schema_username
                                        ),
                                        'refTable' VALUE r_ac.table_name,
                                        'refColumns' VALUE (
                                            SELECT JSON_ARRAYAGG(racc.column_name ORDER BY racc.position)
                                            FROM all_cons_columns racc
                                            WHERE racc.constraint_name = ac.r_constraint_name
                                                AND racc.owner = r_ac.owner
                                        ),
                                        'onDelete' VALUE CASE 
                                            WHEN ac.delete_rule = 'CASCADE' THEN 'cascade'
                                            WHEN ac.delete_rule = 'SET NULL' THEN 'setNull'
                                            WHEN ac.delete_rule = 'NO ACTION' THEN 'noAction'
                                            WHEN ac.delete_rule = 'RESTRICT' THEN 'restrict'
                                            ELSE 'restrict'
                                        END
                                    )
                                    ORDER BY ac.constraint_name
                                )
                                FROM all_constraints ac
                                JOIN all_constraints r_ac
                                    ON ac.r_constraint_name = r_ac.constraint_name
                                    AND ac.r_owner = r_ac.owner
                                WHERE ac.table_name = at.table_name
                                    AND ac.owner = c_schema_username
                                    AND ac.constraint_type = 'R'
                            )
                        )
                        ORDER BY at.table_name
                    )
                    FROM all_tables at
                    WHERE at.owner = c_schema_username
                )
            )
            RETURNING CLOB PRETTY
        ) INTO r FROM dual;
        
        print(r);
    END export_schema;

    PROCEDURE import_schema (
        p_schema_username IN VARCHAR2,
        p_clob            IN CLOB
    ) IS
        v_schema VARCHAR2(128 CHAR) := TRIM(UPPER(p_schema_username));
        v_json   JSON_OBJECT_T;
        v_tables JSON_ARRAY_T;
        v_table  JSON_OBJECT_T;
        v_columns JSON_ARRAY_T;
        v_column JSON_OBJECT_T;
        v_pk     JSON_ARRAY_T;
        v_unique JSON_ARRAY_T;
        v_unique_cols JSON_ARRAY_T;
        v_indexes JSON_ARRAY_T;
        v_index  JSON_OBJECT_T;
        v_idx_cols JSON_ARRAY_T;
        v_fks    JSON_ARRAY_T;
        v_fk     JSON_OBJECT_T;
        v_fk_cols JSON_ARRAY_T;
        v_ref_cols JSON_ARRAY_T;
        
        v_sql    CLOB;
        v_result CLOB := '';
        v_table_name VARCHAR2(128 CHAR);
        v_col_name VARCHAR2(128 CHAR);
        v_col_type VARCHAR2(128 CHAR);
        v_col_default CLOB;
        v_col_nullable VARCHAR2(1 CHAR);
        v_col_identity VARCHAR2(3 CHAR);
        v_first  BOOLEAN;
        v_idx_name VARCHAR2(128 CHAR);
        v_is_unique NUMBER;
        v_ref_table VARCHAR2(128 CHAR);
        v_on_delete VARCHAR2(20 CHAR);
        v_pk_constraint_name VARCHAR2(128 CHAR);
        v_uq_constraint_name VARCHAR2(128 CHAR);
        v_fk_constraint_name VARCHAR2(128 CHAR);
        v_uq_constraint_num  PLS_INTEGER := 0;
        v_fk_constraint_num  PLS_INTEGER := 0;
        
        PROCEDURE append(p_text IN VARCHAR2) IS
        BEGIN
            v_result := v_result || p_text || CHR(10);
        END append;
        
        PROCEDURE append_clob(p_text IN CLOB) IS
        BEGIN
            v_result := v_result || p_text || CHR(10);
        END append_clob;
        
    BEGIN
        v_json := JSON_OBJECT_T.parse(p_clob);
        v_tables := v_json.get_Array('tables');
        
        IF v_tables IS NULL OR v_tables.get_size() = 0 THEN
            DBMS_OUTPUT.PUT_LINE('-- No tables found in schema');
            RETURN;
        END IF;
        
        append('-- Schema' || CHR(58) || ' ' || v_schema);
        append('-- Generated' || CHR(58) || ' ' || TO_CHAR(SYSTIMESTAMP, 'YYYY-MM-DD HH24' || CHR(58) || 'MI' || CHR(58) || 'SS'));
        append('-- Idempotent DDL - safe to run multiple times');
        append('');
        
        -- First pass: Create all tables with columns and primary keys
        FOR i IN 0 .. v_tables.get_size() - 1 LOOP
            v_table := TREAT(v_tables.get(i) AS JSON_OBJECT_T);
            v_table_name := v_table.get_String('name');
            v_columns := v_table.get_Array('columns');
            v_pk := v_table.get_Array('primary_key');
            
            append('-- Table' || CHR(58) || ' ' || v_table_name);
            append('DECLARE');
            append('    v_exists NUMBER;');
            append('BEGIN');
            append('    SELECT COUNT(*) INTO v_exists FROM all_tables WHERE owner = ''' || v_schema || ''' AND table_name = ''' || v_table_name || ''';');
            append('    IF v_exists = 0 THEN');
            append('        EXECUTE IMMEDIATE ''');
            
            v_sql := 'CREATE TABLE ' || v_schema || '.' || v_table_name || ' (';
            append(v_sql);
            
            v_first := TRUE;
            FOR j IN 0 .. v_columns.get_size() - 1 LOOP
                v_column := TREAT(v_columns.get(j) AS JSON_OBJECT_T);
                v_col_name := v_column.get_String('name');
                v_col_type := v_column.get_String('type');
                v_col_nullable := CASE WHEN v_column.get_Boolean('nullable') THEN 1 ELSE 0 END;
                v_col_identity := CASE WHEN v_column.get_Boolean('identity') THEN 1 ELSE 0 END;

                IF v_col_identity = 1 THEN
                    v_col_type := v_col_type || ' GENERATED BY DEFAULT AS IDENTITY';
                END IF;
                
                IF v_column.has('default') AND NOT v_column.get('default').is_null() THEN
                    v_col_default := v_column.get_Clob('default');
                ELSE
                    v_col_default := NULL;
                END IF;
                
                v_sql := '            ';
                IF NOT v_first THEN
                    v_sql := '           ,';
                END IF;
                v_first := FALSE;
                
                v_sql := v_sql || v_col_name || ' ' || v_col_type;
                
                IF v_col_default IS NOT NULL THEN
                    -- Escape single quotes in default value
                    v_sql := v_sql || ' DEFAULT ' || REPLACE(v_col_default, '''', '''''');
                END IF;
                
                IF v_col_nullable = 0 THEN
                    v_sql := v_sql || ' NOT NULL';
                END IF;
                
                append(v_sql);
            END LOOP;
            
            -- Add primary key constraint inline
            IF v_pk IS NOT NULL AND v_pk.get_size() > 0 THEN
                v_pk_constraint_name := 'PK_' || v_table_name;
                v_sql := '           ,CONSTRAINT ' || v_pk_constraint_name || ' PRIMARY KEY (';
                v_first := TRUE;
                FOR k IN 0 .. v_pk.get_size() - 1 LOOP
                    IF NOT v_first THEN
                        v_sql := v_sql || ', ';
                    END IF;
                    v_first := FALSE;
                    v_sql := v_sql || v_pk.get_String(k);
                END LOOP;
                v_sql := v_sql || ')';
                append(v_sql);
            END IF;
            
            append('        )'';');
            append('    END IF;');
            append('END;');
            append('/');
            append('');
        END LOOP;
        
        -- Second pass: Add unique constraints
        FOR i IN 0 .. v_tables.get_size() - 1 LOOP
            v_table := TREAT(v_tables.get(i) AS JSON_OBJECT_T);
            v_table_name := v_table.get_String('name');
            v_unique := v_table.get_Array('unique');
            
            IF v_unique IS NOT NULL AND v_unique.get_size() > 0 THEN
                FOR u IN 0 .. v_unique.get_size() - 1 LOOP
                    v_unique_cols := TREAT(v_unique.get(u) AS JSON_ARRAY_T);
                    IF v_unique_cols IS NOT NULL AND v_unique_cols.get_size() > 0 THEN
                        v_uq_constraint_num := v_uq_constraint_num + 1;
                        v_uq_constraint_name := 'UQ_' || v_table_name || '_' || v_uq_constraint_num;
                        
                        -- Build column list for comparison
                        v_sql := '';
                        v_first := TRUE;
                        FOR c IN 0 .. v_unique_cols.get_size() - 1 LOOP
                            IF NOT v_first THEN
                                v_sql := v_sql || ',';
                            END IF;
                            v_first := FALSE;
                            v_sql := v_sql || v_unique_cols.get_String(c);
                        END LOOP;
                        
                        append('DECLARE');
                        append('    v_exists NUMBER;');
                        append('BEGIN');
                        append('    -- Check if unique constraint on these columns already exists');
                        append('    SELECT COUNT(*) INTO v_exists FROM all_constraints ac');
                        append('    WHERE ac.owner = ''' || v_schema || '''');
                        append('      AND ac.table_name = ''' || v_table_name || '''');
                        append('      AND ac.constraint_type IN (''U'', ''P'')');
                        append('      AND (SELECT LISTAGG(acc.column_name, '','') WITHIN GROUP (ORDER BY acc.position)');
                        append('           FROM all_cons_columns acc WHERE acc.owner = ac.owner AND acc.constraint_name = ac.constraint_name) = ''' || v_sql || ''';');
                        append('    IF v_exists = 0 THEN');
                        
                        v_sql := '        EXECUTE IMMEDIATE ''ALTER TABLE ' || v_schema || '.' || v_table_name || 
                                 ' ADD CONSTRAINT ' || v_uq_constraint_name || ' UNIQUE (';
                        v_first := TRUE;
                        FOR c IN 0 .. v_unique_cols.get_size() - 1 LOOP
                            IF NOT v_first THEN
                                v_sql := v_sql || ', ';
                            END IF;
                            v_first := FALSE;
                            v_sql := v_sql || v_unique_cols.get_String(c);
                        END LOOP;
                        v_sql := v_sql || ')'';';
                        append(v_sql);
                        append('    END IF;');
                        append('END;');
                        append('/');
                        append('');
                    END IF;
                END LOOP;
            END IF;
        END LOOP;
        
        -- Third pass: Create indexes
        FOR i IN 0 .. v_tables.get_size() - 1 LOOP
            v_table := TREAT(v_tables.get(i) AS JSON_OBJECT_T);
            v_table_name := v_table.get_String('name');
            v_indexes := v_table.get_Array('indexes');
            
            IF v_indexes IS NOT NULL AND v_indexes.get_size() > 0 THEN
                FOR idx IN 0 .. v_indexes.get_size() - 1 LOOP
                    v_index := TREAT(v_indexes.get(idx) AS JSON_OBJECT_T);
                    v_idx_name := v_index.get_String('name');
                    v_idx_cols := v_index.get_Array('columns');
                    v_is_unique := v_index.get_Number('unique');
                    
                    append('DECLARE');
                    append('    v_exists NUMBER;');
                    append('BEGIN');
                    append('    SELECT COUNT(*) INTO v_exists FROM all_indexes WHERE owner = ''' || v_schema || ''' AND index_name = ''' || v_idx_name || ''';');
                    append('    IF v_exists = 0 THEN');
                    
                    IF v_is_unique = 1 THEN
                        v_sql := '        EXECUTE IMMEDIATE ''CREATE UNIQUE INDEX ';
                    ELSE
                        v_sql := '        EXECUTE IMMEDIATE ''CREATE INDEX ';
                    END IF;
                    
                    v_sql := v_sql || v_schema || '.' || v_idx_name || ' ON ' || 
                             v_schema || '.' || v_table_name || ' (';
                    
                    v_first := TRUE;
                    FOR c IN 0 .. v_idx_cols.get_size() - 1 LOOP
                        IF NOT v_first THEN
                            v_sql := v_sql || ', ';
                        END IF;
                        v_first := FALSE;
                        v_sql := v_sql || v_idx_cols.get_String(c);
                    END LOOP;
                    v_sql := v_sql || ')'';';
                    append(v_sql);
                    append('    END IF;');
                    append('END;');
                    append('/');
                    append('');
                END LOOP;
            END IF;
        END LOOP;
        
        -- Fourth pass: Add foreign key constraints
        FOR i IN 0 .. v_tables.get_size() - 1 LOOP
            v_table := TREAT(v_tables.get(i) AS JSON_OBJECT_T);
            v_table_name := v_table.get_String('name');
            v_fks := v_table.get_Array('foreignKeys');
            
            IF v_fks IS NOT NULL AND v_fks.get_size() > 0 THEN
                FOR f IN 0 .. v_fks.get_size() - 1 LOOP
                    v_fk := TREAT(v_fks.get(f) AS JSON_OBJECT_T);
                    v_fk_cols := v_fk.get_Array('columns');
                    v_ref_table := v_fk.get_String('refTable');
                    v_ref_cols := v_fk.get_Array('refColumns');
                    v_on_delete := v_fk.get_String('onDelete');
                    
                    v_fk_constraint_num := v_fk_constraint_num + 1;
                    v_fk_constraint_name := 'FK_' || v_table_name || '_' || v_fk_constraint_num;
                    
                    append('DECLARE');
                    append('    v_exists NUMBER;');
                    append('BEGIN');
                    append('    SELECT COUNT(*) INTO v_exists FROM all_constraints WHERE owner = ''' || v_schema || ''' AND constraint_name = ''' || v_fk_constraint_name || ''';');
                    append('    IF v_exists = 0 THEN');
                    
                    v_sql := '        EXECUTE IMMEDIATE ''ALTER TABLE ' || v_schema || '.' || v_table_name || 
                             ' ADD CONSTRAINT ' || v_fk_constraint_name || ' FOREIGN KEY (';
                    
                    v_first := TRUE;
                    FOR c IN 0 .. v_fk_cols.get_size() - 1 LOOP
                        IF NOT v_first THEN
                            v_sql := v_sql || ', ';
                        END IF;
                        v_first := FALSE;
                        v_sql := v_sql || v_fk_cols.get_String(c);
                    END LOOP;
                    
                    v_sql := v_sql || ') REFERENCES ' || v_schema || '.' || v_ref_table || ' (';
                    
                    v_first := TRUE;
                    FOR c IN 0 .. v_ref_cols.get_size() - 1 LOOP
                        IF NOT v_first THEN
                            v_sql := v_sql || ', ';
                        END IF;
                        v_first := FALSE;
                        v_sql := v_sql || v_ref_cols.get_String(c);
                    END LOOP;
                    
                    v_sql := v_sql || ')';
                    
                    IF v_on_delete IS NOT NULL THEN
                        IF v_on_delete = 'cascade' THEN
                            v_sql := v_sql || ' ON DELETE CASCADE';
                        ELSIF v_on_delete = 'setNull' THEN
                            v_sql := v_sql || ' ON DELETE SET NULL';
                        END IF;
                    END IF;
                    
                    v_sql := v_sql || ''';';
                    append(v_sql);
                    append('    END IF;');
                    append('END;');
                    append('/');
                    append('');
                END LOOP;
            END IF;
        END LOOP;
        
        print(v_result);
    END import_schema;

END odbvue;
/

