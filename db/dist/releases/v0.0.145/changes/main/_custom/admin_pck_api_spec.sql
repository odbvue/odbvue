-- liquibase formatted sql
-- changeset  SqlCl:1763039347901 stripComments:false logicalFilePath:main\_custom\admin_pck_api_spec.sql
-- sqlcl_snapshot dist\releases\next\changes\main\_custom\admin_pck_api_spec.sql:null:null:custom

create or replace package pck_api_admin AUTHID CURRENT_USER AS -- Provides technical management and operations capabilities

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

procedure create_cred( -- Creates a database credential
    p_schema VARCHAR2, -- schema name
    p_cred_name VARCHAR2, -- Credential name
    p_username VARCHAR2, -- Username
    p_password VARCHAR2 -- Password
);

end pck_api_admin;

