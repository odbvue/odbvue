create or replace package pck_api_admin AS -- Provides technical management and operations capabilities

procedure acl_append_host( -- Appends record to Access Control List (ACL)
    p_schema VARCHAR2, -- schema name
    p_host VARCHAR2, -- Host
    p_lower_port PLS_INTEGER, -- Lower port
    p_upper_port PLS_INTEGER, -- Upper port
    p_privilege VARCHAR2 -- Privilege
);

procedure acl_remove_all_hosts( -- Removes all ACL records for given schema
    p_schema VARCHAR2 -- schema name
);

end pck_api_admin;
