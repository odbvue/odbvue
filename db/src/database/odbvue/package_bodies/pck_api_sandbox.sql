create or replace package body odbvue.pck_api_sandbox as

    procedure whoami as

        type t_attr_list is
            table of varchar2(64);
        v_attrs t_attr_list := t_attr_list('SESSION_USER', 'CURRENT_USER', 'CURRENT_SCHEMA', 'CURRENT_SCHEMAID', 'SESSIONID',
                                           'HOST', 'IP_ADDRESS', 'OS_USER', 'TERMINAL', 'DB_NAME',
                                           'INSTANCE_NAME', 'SERVICE_NAME', 'MODULE', 'ACTION', 'CLIENT_IDENTIFIER',
                                           'AUTHENTICATED_IDENTITY', 'PROXY_USER', 'CURRENT_EDITION_NAME', 'ENTRYID', 'LANG',
                                           'LANGUAGE');

        function tocamelcase (
            p_str in varchar2
        ) return varchar2 is
            v_result     varchar2(4000);
            v_next_upper boolean := false;
        begin
            for i in 1..length(p_str) loop
                if substr(p_str, i, 1) = '_' then
                    v_next_upper := true;
                elsif v_next_upper then
                    v_result := v_result
                                || upper(substr(p_str, i, 1));
                    v_next_upper := false;
                else
                    v_result := v_result
                                || lower(substr(p_str, i, 1));
                end if;
            end loop;

            return v_result;
        end tocamelcase;

    begin
        dbms_output.put_line('whoami:');
        for i in 1..v_attrs.count loop
            begin
                dbms_output.put_line('  '
                                     || tocamelcase(v_attrs(i))
                                     || ': ' || sys_context('USERENV',
                                                            v_attrs(i)));

            exception
                when others then
                    dbms_output.put_line('  '
                                         || tocamelcase(v_attrs(i)) || ': <not available>');
            end;
        end loop;

    end whoami;

end pck_api_sandbox;
/


-- sqlcl_snapshot {"hash":"3f4f89c1f3e3a5e79d7050bed5641ad62f21644c","type":"PACKAGE_BODY","name":"PCK_API_SANDBOX","schemaName":"ODBVUE","sxml":""}