-- liquibase formatted sql
-- changeset ODBVUE:1768206719627 stripComments:false  logicalFilePath:featcrm\odbvue\package_bodies\pck_api_sandbox.sql
-- sqlcl_snapshot db/src/database/odbvue/package_bodies/pck_api_sandbox.sql:null:e1118b5d9003203c75bd494f3261729d77293cee:create

CREATE OR REPLACE PACKAGE BODY odbvue.pck_api_sandbox AS

    PROCEDURE whoami AS

        TYPE t_attr_list IS
            TABLE OF VARCHAR2(64);
        v_attrs t_attr_list := t_attr_list('SESSION_USER', 'CURRENT_USER', 'CURRENT_SCHEMA', 'CURRENT_SCHEMAID', 'SESSIONID',
                                           'HOST', 'IP_ADDRESS', 'OS_USER', 'TERMINAL', 'DB_NAME',
                                           'INSTANCE_NAME', 'SERVICE_NAME', 'MODULE', 'ACTION', 'CLIENT_IDENTIFIER',
                                           'AUTHENTICATED_IDENTITY', 'PROXY_USER', 'CURRENT_EDITION_NAME', 'ENTRYID', 'LANG',
                                           'LANGUAGE');

        FUNCTION tocamelcase (
            p_str IN VARCHAR2
        ) RETURN VARCHAR2 IS
            v_result     VARCHAR2(4000);
            v_next_upper BOOLEAN := FALSE;
        BEGIN
            FOR i IN 1..length(p_str) LOOP
                IF substr(p_str, i, 1) = '_' THEN
                    v_next_upper := TRUE;
                ELSIF v_next_upper THEN
                    v_result := v_result
                                || upper(substr(p_str, i, 1));
                    v_next_upper := FALSE;
                ELSE
                    v_result := v_result
                                || lower(substr(p_str, i, 1));
                END IF;
            END LOOP;

            RETURN v_result;
        END tocamelcase;

    BEGIN
        dbms_output.put_line('whoami:');
        FOR i IN 1..v_attrs.count LOOP
            BEGIN
                dbms_output.put_line('  '
                                     || tocamelcase(v_attrs(i))
                                     || ': ' || sys_context('USERENV',
                                                            v_attrs(i)));

            EXCEPTION
                WHEN OTHERS THEN
                    dbms_output.put_line('  '
                                         || tocamelcase(v_attrs(i)) || ': <not available>');
            END;
        END LOOP;

    END whoami;

END pck_api_sandbox;
/

