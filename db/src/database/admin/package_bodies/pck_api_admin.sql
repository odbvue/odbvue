create or replace package BODY pck_api_admin AS 

procedure acl_append_host( 
    p_schema VARCHAR2,
    p_host VARCHAR2, 
    p_lower_port PLS_INTEGER, 
    p_upper_port PLS_INTEGER, 
    p_privilege VARCHAR2 
) AS 
BEGIN
    DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACE (
            host => p_host,
            lower_port => p_lower_port,
            upper_port => p_upper_port,
            ace => xs$ace_type(
                privilege_list => xs$name_list(p_privilege),
                principal_name => UPPER(p_schema),
                principal_type => xs_acl.ptype_db
            )
        );

        COMMIT;

    END;

    procedure acl_remove_all_hosts( 
        p_schema VARCHAR2
    ) AS 
    BEGIN
        FOR e IN (
            SELECT
                host,
                lower_port,
                upper_port,
                privilege
            FROM dba_host_aces
            WHERE principal = UPPER(p_schema)
        ) LOOP
            BEGIN
                DBMS_NETWORK_ACL_ADMIN.REMOVE_HOST_ACE (
                    e.host,
                    e.lower_port,
                    e.upper_port,
                    xs$ace_type(
                        privilege_list => xs$name_list(e.privilege),
                        principal_name => UPPER(p_schema),
                        principal_type => xs_acl.ptype_db
                    )
                );
                COMMIT;
            EXCEPTION
                WHEN OTHERS THEN
                    DBMS_OUTPUT.PUT_LINE('Error removing ACE for host ' || e.host || 
                        ' -> ' || e.privilege || 
                        ' (' || e.lower_port || '-' || e.upper_port || '): ' || SQLERRM);
            END;        
        END LOOP;
    END;

end pck_api_admin;
